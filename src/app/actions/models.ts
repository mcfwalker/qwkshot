'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid'; // Need to install uuid: npm install uuid @types/uuid
import { MetadataManagerFactory } from '@/features/p2p/metadata-manager/MetadataManagerFactory';
import { ModelMetadata, DatabaseError } from '@/types/p2p/metadata-manager'; // Import DatabaseError correctly
import { Logger } from '@/types/p2p/shared'; // Import Logger type
import { EnvironmentalMetadata } from '@/types/p2p/environmental-metadata'; // Import Env Metadata type

// Create a simple console-based logger matching the Logger interface
const logger: Logger = {
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug, 
    trace: console.trace,
    performance: (...args) => console.debug('[PERF]', ...args), // Map performance to debug for now
};

const metadataManagerFactory = new MetadataManagerFactory(logger);

interface PrepareUploadArgs {
    fileName: string;
    fileSize: number;
    fileType: string;
    userId: string; // Should ideally get this server-side from session
    modelName: string; // Name provided by user in dialog
    initialMetadata: ModelMetadata; // The full object from client-side processModel
}

interface PrepareUploadResult {
    modelId: string;
    signedUploadUrl: string;
    error?: string;
}

export async function prepareModelUpload(args: PrepareUploadArgs): Promise<PrepareUploadResult> {
    logger.info('prepareModelUpload Server Action started', { args: { ...args, initialMetadata: '[omitted]' } });

    const { fileName, fileSize, fileType, userId, modelName, initialMetadata } = args;
    const supabase = createServerActionClient({ cookies }); // Use server action client

    // TODO: Ideally, verify userId against server session
    // const { data: { session } } = await supabase.auth.getSession();
    // if (!session || session.user.id !== userId) {
    //     logger.error('User ID mismatch or no session');
    //     return { error: 'Authentication error' };
    // }

    const modelId = uuidv4();
    const modelPath = `models/${userId}/${modelId}/${fileName}`;
    logger.info(`Generated modelId: ${modelId}, path: ${modelPath}`);

    try {
        // Get MetadataManager with Service Role
        const metadataManager = metadataManagerFactory.create({
             database: { 
                 type: 'supabase', 
                 url: process.env.NEXT_PUBLIC_SUPABASE_URL!, 
                 key: process.env.SUPABASE_SERVICE_ROLE_KEY! 
             },
             // Add missing required config fields
             caching: { enabled: false, ttl: 0 }, 
             validation: { strict: false, maxFeaturePoints: 100 } 
           }, 
           'serviceRole'
        );
        await metadataManager.initialize();
        logger.info('Server-side MetadataManager initialized (Service Role)');

        // --- Step 1: Insert Minimal Record --- 
        logger.info(`Attempting initial insert for modelId: ${modelId}`);
        const { data: insertData, error: insertError } = await supabase
            .from('models')
            .insert({
                id: modelId,
                user_id: userId,
                name: modelName, 
                file_url: modelPath,
                // Pass empty metadata object initially or only valid sub-fields
                metadata: {} 
            })
            .select('id')
            .single();

        if (insertError) {
            logger.error('Initial database insert error', insertError);
            throw new DatabaseError(`Initial insert failed: ${insertError.message}`);
        }
        logger.info(`Initial record inserted successfully for modelId: ${modelId}`);

        // --- Step 2: Generate Signed URL --- 
        logger.info(`Generating signed upload URL for path: ${modelPath}`);
        const { data: signedUrlData, error: signedUrlError } = await supabase
            .storage
            .from('models')
            .createSignedUploadUrl(modelPath);

        if (signedUrlError) {
            logger.error('Failed to create signed upload URL', signedUrlError);
            // TODO: Attempt to delete the initial DB record if URL generation fails?
            throw new Error(`Storage URL generation failed: ${signedUrlError.message}`);
        }
        if (!signedUrlData?.signedUrl) {
             logger.error('Signed URL data is missing URL string');
             throw new Error('Storage URL generation failed: Signed URL missing');
        }
        logger.info(`Signed upload URL generated successfully`);

        // --- Step 3: Store Full Metadata --- 
        logger.info(`Storing full metadata and scene_analysis for modelId: ${modelId}`);
        const metadataToStore: ModelMetadata = {
            ...initialMetadata, 
            id: modelId,       
            modelId: modelId,
            userId: userId,
            file: modelPath, 
            createdAt: initialMetadata.createdAt || new Date(),
            updatedAt: new Date(),
            version: initialMetadata.version || 1,
        };

        await metadataManager.storeModelMetadata(modelId, metadataToStore);
        logger.info(`Full metadata stored successfully for modelId: ${modelId}`);

        // --- Step 4: Return Result --- 
        return { modelId, signedUploadUrl: signedUrlData.signedUrl };

    } catch (error) {
        logger.error('Error in prepareModelUpload action:', error);
        // Return structure matching PrepareUploadResult on error
        return { 
            error: error instanceof Error ? error.message : 'Failed to prepare model upload',
            modelId: modelId || '', // Return generated ID even on failure if available
            signedUploadUrl: '' // Return empty URL on failure
        };
    }
}

// --- New Server Action for Environmental Metadata --- 

interface UpdateEnvMetadataArgs {
    modelId: string;
    metadata: EnvironmentalMetadata;
}

interface UpdateEnvMetadataResult {
    success: boolean;
    error?: string;
}

export async function updateEnvironmentalMetadataAction(
    args: UpdateEnvMetadataArgs
): Promise<UpdateEnvMetadataResult> {
    logger.info('updateEnvironmentalMetadataAction Server Action started', { modelId: args.modelId });
    const { modelId, metadata } = args;

    // TODO: Add server-side session validation if needed
    // const supabase = createServerActionClient({ cookies });
    // const { data: { session } } = await supabase.auth.getSession();
    // if (!session) { return { success: false, error: 'Not authenticated' }; }
    // You might also verify session.user.id owns the modelId

    if (!modelId || !metadata) {
        return { success: false, error: 'Missing modelId or metadata' };
    }

    try {
        // Get MetadataManager with Service Role
        const metadataManager = metadataManagerFactory.create({
             database: { 
                 type: 'supabase', 
                 url: process.env.NEXT_PUBLIC_SUPABASE_URL!, 
                 key: process.env.SUPABASE_SERVICE_ROLE_KEY! 
             },
             caching: { enabled: false, ttl: 0 }, 
             validation: { strict: false, maxFeaturePoints: 100 } 
           }, 
           'serviceRole'
        );
        await metadataManager.initialize();
        logger.info('Server-side MetadataManager initialized for Env Update');

        // Call the manager's method to store/update environmental metadata
        // This internally handles the logic of checking if it exists first
        await metadataManager.updateEnvironmentalMetadata(modelId, metadata);
        // OR potentially call store directly if update isn't suitable:
        // await metadataManager.storeEnvironmentalMetadata(modelId, metadata);

        logger.info(`Successfully updated/stored environmental metadata for model: ${modelId}`);
        return { success: true };

    } catch (error) {
        logger.error(`Error in updateEnvironmentalMetadataAction for model ${modelId}:`, error);
        return { 
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update environmental metadata' 
        };
    }
} 