'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Logger } from '@/types/p2p/shared'; 
// Import other necessary types and libraries as needed (e.g., gltf-transform, Supabase types)
import { SerializedSceneAnalysis } from '@/types/p2p/scene-analyzer';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
// import { SupabaseClient } from '@supabase/supabase-js';


// Placeholder logger (replace with shared logger if available)
const logger: Logger = {
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug, 
    trace: console.trace,
    performance: (...args) => console.debug('[PERF]', ...args), 
};

interface NormalizeActionResult {
    success: boolean;
    message?: string;
    error?: string;
}

/**
 * Server action to normalize a model's geometry after initial upload.
 * - Downloads the original GLB from storage.
 * - Calculates and applies normalization transform (translate to origin, ground Y, scale).
 * - Uploads the normalized GLB, replacing the original.
 * - Optionally re-analyzes and updates database metadata.
 * @param modelId The ID of the model to normalize.
 * @returns Promise<NormalizeActionResult> Result indicating success or failure.
 */
export async function normalizeModelAction(modelId: string): Promise<NormalizeActionResult> {
    logger.info(`normalizeModelAction called for modelId: ${modelId}`);
    
    if (!modelId) {
        logger.error('normalizeModelAction: Missing modelId');
        return { success: false, error: 'Model ID is required.' };
    }

    const supabase = createServerActionClient({ cookies }, {
        // Use service role key for backend operations like storage access/modification
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    });
    
    try {
        // --- TODO: Implement Normalization Steps ---
        // 1. Get model data (especially file_url and scene_analysis) from DB using modelId
        logger.info(`Fetching model data for ${modelId}`);
        const { data: modelData, error: fetchError } = await supabase
            .from('models')
            .select('file_url, scene_analysis') // Select both needed columns
            .eq('id', modelId)
            .single();

        if (fetchError) {
            logger.error(`Database error fetching model ${modelId}:`, fetchError);
            throw new Error(`Failed to fetch model data: ${fetchError.message}`);
        }

        if (!modelData || !modelData.file_url || !modelData.scene_analysis) {
            logger.error(`Missing essential data for model ${modelId}`, { modelData });
            throw new Error('Model data is incomplete (missing file_url or scene_analysis).');
        }

        const originalFilePath = modelData.file_url;
        // Cast scene_analysis to the imported type
        const originalSceneAnalysis = modelData.scene_analysis as SerializedSceneAnalysis;
        
        logger.info(`Successfully fetched data for ${modelId}`, { originalFilePath });
        // We now have originalFilePath and originalSceneAnalysis
        
        // 2. Download original GLB from storage using file_url
        logger.info(`Downloading original GLB file from path: ${originalFilePath}`);
        const { data: glbBlob, error: downloadError } = await supabase
            .storage
            .from('models') // Ensure this matches the bucket name
            .download(originalFilePath);
            
        if (downloadError) {
            logger.error(`Error downloading file ${originalFilePath} for model ${modelId}:`, downloadError);
            throw new Error(`Failed to download original model file: ${downloadError.message}`);
        }

        if (!glbBlob) {
            logger.error(`Downloaded file blob is null for ${originalFilePath}`);
            throw new Error('Downloaded model file is empty or corrupted.');
        }

        const glbArrayBuffer = await glbBlob.arrayBuffer();
        logger.info(`Successfully downloaded GLB file for ${modelId}, size: ${glbArrayBuffer.byteLength} bytes`);
        // We now have the original GLB content in glbArrayBuffer

        // 3. Use gltf-transform to load the GLB data
        const io = new NodeIO();
        io.registerExtensions(ALL_EXTENSIONS); // Register extensions like Draco, etc.
        
        logger.info('Parsing GLB data with gltf-transform...');
        const document: Document = await io.readBinary(new Uint8Array(glbArrayBuffer));
        logger.info('Successfully parsed GLB into gltf-transform document.');
        // We now have the GLTF document object ready for manipulation
        
        // 4. Get original scene_analysis data (for bbox/center) from DB <-- Already done in step 1
        // 5. Calculate scale and translation needed for normalization
        logger.info('Calculating normalization transform...');
        
        // Extract necessary data from the original analysis (these are serialized vectors)
        const min = originalSceneAnalysis.glb.geometry.boundingBox.min;
        const max = originalSceneAnalysis.glb.geometry.boundingBox.max;
        const center = originalSceneAnalysis.glb.geometry.center; // Center of the original bounding box
        
        const currentDimensions = {
            x: max.x - min.x,
            y: max.y - min.y,
            z: max.z - min.z,
        };
        
        // Define target normalized height (adjust as needed)
        const TARGET_NORMALIZED_HEIGHT = 2.0; 
        
        let scaleFactor = 1.0;
        // Check for non-zero height to avoid division by zero or excessive scaling
        if (Math.abs(currentDimensions.y) > 1e-6) { 
            scaleFactor = TARGET_NORMALIZED_HEIGHT / currentDimensions.y;
        } else {
            logger.warn(`Model ${modelId} has zero or near-zero height (${currentDimensions.y}). Skipping scaling.`);
            // Optionally set scaleFactor to 1.0 explicitly or handle differently
            scaleFactor = 1.0; 
        }
        
        // Calculate translation needed AFTER scaling is applied, to center X/Z and ground Y.
        // The final translation moves the scaled model's origin (center.x * scale, min.y * scale, center.z * scale) to the world origin (0, 0, 0).
        const translation: [number, number, number] = [
            -(center.x * scaleFactor), // Move scaled center X to 0
            -(min.y * scaleFactor),   // Move scaled min Y to 0 (grounding)
            -(center.z * scaleFactor)  // Move scaled center Z to 0
        ];
        
        logger.info(`Calculated normalization transform for ${modelId}`, { scaleFactor, translation });
        // We now have scaleFactor and translation [x, y, z]

        // 6. Apply transforms using gltf-transform
        // 7. Save transformed GLB data (in memory or temp file)
        // 8. Upload normalized GLB to storage (overwrite original file_url path)
        // 9. (Optional but recommended) Re-run SceneAnalyzer on normalized data
        // 10. Update scene_analysis in DB with results from normalized data
        
        logger.info(`Placeholder: Normalization logic for ${modelId} needs implementation.`);
        
        // Placeholder success
        return { success: true, message: `Normalization initiated for ${modelId} (Implementation Pending)` };

    } catch (error) {
        logger.error(`Error during normalization for modelId ${modelId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during normalization.';
        // TODO: Consider more specific error handling/reporting
        return { success: false, error: errorMessage };
    }
} 