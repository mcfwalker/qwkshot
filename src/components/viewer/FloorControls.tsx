'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Grid, X, ImageIcon, AlertTriangle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FloorType } from './Floor';
import { supabase } from '@/lib/supabase';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FloorTexture } from '@/lib/supabase';

// Update Alert component styling
const Alert = ({ variant, className, children }: { 
  variant?: 'default' | 'destructive'; 
  className?: string;
  children: React.ReactNode;
}) => (
  <div className={`p-3 border rounded-md ${
    variant === 'destructive' 
      ? 'bg-destructive/10 border-destructive/20 text-destructive' 
      : 'bg-secondary/20 border-border/50'
    } ${className || ''}`}>
    {children}
  </div>
);

const AlertDescription = ({ children }: { children: React.ReactNode }) => (
  <div className="text-sm text-muted-foreground">{children}</div>
);

interface FloorControlsProps {
  onFloorTypeChange: (type: FloorType) => void;
  onFloorTextureChange: (textureUrl: string) => void;
  currentFloorType: FloorType;
}

export default function FloorControls({
  onFloorTypeChange,
  onFloorTextureChange,
  currentFloorType
}: FloorControlsProps) {
  const [uploadingTexture, setUploadingTexture] = useState(false);
  const [textures, setTextures] = useState<FloorTexture[]>([]);
  const [loadingTextures, setLoadingTextures] = useState(true);
  const [selectedTextureId, setSelectedTextureId] = useState<string | null>(null);
  const [bucketError, setBucketError] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);

  // Check storage bucket and database table
  useEffect(() => {
    async function checkConfiguration() {
      // Verify Supabase client initialization
      if (!supabase) {
        console.error('Supabase client is not initialized');
        setBucketError('Database connection not initialized');
        setTableError('Database connection not initialized');
        return;
      }

      // Log Supabase URL to verify it's correct (without exposing full key)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      console.log('Using Supabase URL:', supabaseUrl ? 'configured' : 'missing');
      
      // Check if database table exists
      try {
        console.log('Checking floor_textures table...');
        // Try to get just one row to check if the table exists
        const { data, error } = await supabase
          .from('floor_textures')
          .select('id')
          .limit(1);
          
        if (error) {
          const errorMessage = typeof error === 'object' && error !== null 
            ? JSON.stringify(error) 
            : 'Unknown error';
          console.error('Error checking floor_textures table:', errorMessage);
          setTableError(`Database table error: ${error.message || errorMessage}`);
        } else {
          // Clear error if table exists
          console.log('Floor textures table exists and is accessible', data);
          setTableError(null);
          
          // If we can access the table, check the storage bucket
          try {
            console.log('Checking floor-textures bucket...');
            // First try to list files in the bucket to see if it exists
            const { data: fileData, error: storageError } = await supabase
              .storage
              .from('floor-textures')
              .list('', { limit: 1 });
              
            if (storageError) {
              const errorMessage = typeof storageError === 'object' && storageError !== null 
                ? JSON.stringify(storageError) 
                : 'Unknown storage error';
              console.error('Error accessing floor-textures bucket:', errorMessage);
              setBucketError(`Storage bucket error: ${storageError.message || errorMessage}`);
            } else {
              // Bucket exists if we got here
              console.log('Floor textures bucket exists and is accessible', fileData);
              setBucketError(null);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error checking bucket:', error);
            setBucketError(`Failed to verify storage bucket: ${errorMessage}`);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error checking table:', error);
        setTableError(`Failed to verify database table: ${errorMessage}`);
      }
    }
    
    checkConfiguration();
  }, []);

  // Load textures when component mounts
  useEffect(() => {
    loadTextures();
  }, []);

  // Fetch available textures from the database
  const loadTextures = async () => {
    try {
      console.log('Loading textures from database...');
      setLoadingTextures(true);
      
      // Get textures from database
      const { data, error } = await supabase
        .from('floor_textures')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        const errorMessage = typeof error === 'object' && error !== null 
          ? JSON.stringify(error) 
          : 'Unknown error';
        console.error('Error querying floor_textures table:', errorMessage);
        throw new Error(`Database query error: ${error.message || errorMessage}`);
      }
      
      console.log('Successfully fetched textures:', data?.length || 0);
      
      if (!data || data.length === 0) {
        console.log('No textures found in database');
        setTextures([]);
        setLoadingTextures(false);
        return;
      }
      
      // Create signed URLs for each texture
      console.log('Generating signed URLs for textures...');
      const texturesWithValidUrls: FloorTexture[] = [];
      
      for (const texture of data) {
        try {
          // Skip test entries that we know don't exist
          if (texture.file_url === 'test-image.png') {
            console.log('Skipping test entry:', texture.id);
            continue;
          }
          
          // Get signed URL for the main texture file
          const { data: fileUrlData, error: fileError } = await supabase
            .storage
            .from('floor-textures')
            .createSignedUrl(texture.file_url, 3600);
            
          if (fileError) {
            console.log(`Skipping texture ${texture.id} - File not found: ${texture.file_url}`);
            continue; // Skip this texture if the file doesn't exist
          }
          
          // Get signed URL for the thumbnail if it exists
          let thumbnailUrl = '';
          if (texture.thumbnail_url) {
            try {
              const { data: thumbnailUrlData, error: thumbnailError } = await supabase
                .storage
                .from('floor-textures')
                .createSignedUrl(texture.thumbnail_url, 3600);
                
              if (!thumbnailError) {
                thumbnailUrl = thumbnailUrlData?.signedUrl || '';
              }
            } catch (e) {
              // If thumbnail fails, just continue without it
              console.log(`Thumbnail not found for texture ${texture.id}`);
            }
          }
          
          // If no thumbnail exists, use the main image URL as thumbnail
          if (!thumbnailUrl) {
            thumbnailUrl = fileUrlData?.signedUrl || '';
          }
          
          // Only add textures that have a valid file URL
          if (fileUrlData?.signedUrl) {
            texturesWithValidUrls.push({
              ...texture,
              file_url: fileUrlData.signedUrl,
              thumbnail_url: thumbnailUrl
            });
          }
        } catch (err) {
          console.log(`Error processing texture ${texture.id}:`, err);
          // Skip this texture and continue with others
        }
      }
      
      console.log('Generated URLs for', texturesWithValidUrls.length, 'valid textures');
      setTextures(texturesWithValidUrls);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error loading textures:', error);
      toast.error(`Failed to load floor textures: ${errorMessage}`);
    } finally {
      setLoadingTextures(false);
    }
  };

  // Debug storage access directly
  const testStorageDirectly = async () => {
    console.log('Testing storage permissions directly...');
    
    try {
      // Try to list files first
      console.log('Listing files in floor-textures bucket...');
      const { data: listData, error: listError } = await supabase
        .storage
        .from('floor-textures')
        .list();
      
      if (listError) {
        console.error('Storage list operation failed:', listError);
        toast.error(`Cannot list files: ${listError.message}`);
        return;
      }
      
      console.log('Successfully listed files:', listData);
      toast.success(`Bucket contains ${listData?.length || 0} files`);
      
      // Now try to get bucket details
      const allBuckets = await supabase.storage.listBuckets();
      console.log('All buckets:', allBuckets);
      
    } catch (error) {
      console.error('Storage test error:', error);
      toast.error('Storage test failed');
    }
  };

  // Handle texture upload
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (jpg, png)');
      return;
    }

    try {
      setUploadingTexture(true);
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        toast.error('Authentication required');
        return;
      }
      
      // Generate a unique filename with timestamp
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `texture_${timestamp}.${fileExt}`;
      
      console.log(`Uploading ${fileName} to floor-textures bucket...`);
      
      // Simple direct upload with minimal params
      const { data: fileData, error: uploadError } = await supabase.storage
        .from('floor-textures')
        .upload(fileName, file);
      
      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        toast.error(`Upload failed: ${uploadError.message || 'Storage error'}`);
        return;
      }
      
      console.log('File uploaded successfully:', fileName);
      
      // Create a simple thumbnail - a separate thumbnail seems to be causing issues
      // Instead of creating a separate file, just use the main image for now
      
      // Create database entry
      const newRecord = {
        name: file.name.split('.')[0] || `Texture ${timestamp}`,
        description: '',
        file_url: fileName,
        thumbnail_url: null, // Skip thumbnails for now
        user_id: user.id
      };
      
      console.log('Creating database record:', newRecord);
      
      const { data: insertedData, error: dbError } = await supabase
        .from('floor_textures')
        .insert(newRecord)
        .select();
      
      if (dbError) {
        console.error('Database error:', dbError);
        toast.error(`Database error: ${dbError.message}`);
        return;
      }
      
      console.log('Database record created:', insertedData);
      toast.success('Texture uploaded successfully');
      
      // Refresh the texture list
      await loadTextures();
      
    } catch (error) {
      console.error('Upload failed:', error);
      if (error instanceof Error) {
        toast.error(`Upload failed: ${error.message}`);
      } else {
        toast.error('Upload failed with unknown error');
      }
    } finally {
      setUploadingTexture(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxFiles: 1
  });

  // Handle texture selection
  const handleTextureSelect = (texture: FloorTexture) => {
    setSelectedTextureId(texture.id);
    onFloorTextureChange(texture.file_url);
    
    // Switch to textured mode if not already
    if (currentFloorType !== 'textured') {
      onFloorTypeChange('textured');
    }
  };

  // Original test upload function (keeping for comparison)
  const testUpload = async () => {
    console.log('Running original test upload...');
    
    try {
      // Create a small test image instead of text file
      // Generate a 1x1 pixel transparent PNG
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        toast.error('Canvas context creation failed');
        return;
      }
      
      // Create a simple image
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 1, 1);
      
      // Convert canvas to blob
      const blob = await new Promise<Blob | null>((resolve) => 
        canvas.toBlob(resolve, 'image/png')
      );
      
      if (!blob) {
        toast.error('Failed to create test image');
        return;
      }
      
      // Create a File object from the blob
      const testFile = new File([blob], 'test.png', { type: 'image/png' });
      
      console.log('Test image created');
      
      // Detailed permission and auth check first
      console.log('Checking auth status...');
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        toast.error('Authentication error: Could not get session');
        return;
      }
      
      console.log('Session data:', sessionData?.session ? 'Valid session' : 'No session');
      
      if (!sessionData?.session) {
        toast.error('No active session. Please sign in again.');
        return;
      }
      
      console.log('Auth check passed. User ID:', sessionData.session.user.id);
      
      // Use a unique filename with timestamp
      const timestamp = Date.now();
      const fileName = `test_${timestamp}.png`;
      
      console.log('Attempting storage upload with:', {
        bucket: 'floor-textures',
        path: fileName,
        contentType: 'image/png',
        userId: sessionData.session.user.id
      });
      
      // Upload directly to storage
      const { data: fileData, error: uploadError } = await supabase
        .storage
        .from('floor-textures')
        .upload(fileName, testFile, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: false
        });
        
      if (uploadError) {
        console.error('Test upload failed:', uploadError);
        
        // Check common errors
        if (uploadError.message?.includes('duplicate')) {
          toast.error('File already exists. Try again (names must be unique)');
        } else if (uploadError.message?.includes('permission')) {
          toast.error('Permission denied. Check storage bucket RLS policies');
        } else if (uploadError.message?.includes('mime')) {
          toast.error('File type not allowed. Check allowed MIME types');
        } else {
          toast.error(`Upload error: ${uploadError.message || JSON.stringify(uploadError)}`);
        }
        return;
      }
      
      console.log('Test upload succeeded:', fileData);
      toast.success('Storage upload successful!');
      
      // Try database insert
      console.log('Testing database insert...');
      const { data: user } = await supabase.auth.getUser();
      
      if (!user?.user) {
        console.error('Could not get user');
        toast.error('User authentication required');
        return;
      }
      
      const testRecord = {
        name: `Test Image ${timestamp}`,
        description: 'Test database entry',
        file_url: fileName,
        thumbnail_url: null,
        user_id: user.user.id
      };
      
      console.log('Inserting record:', testRecord);
      
      const { error: dbError, data: dbData } = await supabase
        .from('floor_textures')
        .insert(testRecord)
        .select();
        
      if (dbError) {
        console.error('Test database insert failed:', dbError);
        
        if (dbError.message?.includes('foreign key')) {
          toast.error('Foreign key constraint error. Check user_id matches auth.users.id');
        } else if (dbError.message?.includes('permission')) {
          toast.error('Database permission denied. Check RLS policies');
        } else {
          toast.error(`Database error: ${dbError.message || JSON.stringify(dbError)}`);
        }
        return;
      }
      
      console.log('Database record created:', dbData);
      toast.success('Database insert successful!');
      
      // Try to load the textures to verify full workflow
      await loadTextures();
      
    } catch (error) {
      console.error('Test upload error:', error);
      if (error instanceof Error) {
        toast.error(`Test failed: ${error.message}`);
      } else {
        toast.error('Test upload failed with unknown error');
      }
    }
  };

  // Simpler test upload with minimal base64 image
  const testUploadSimple = async () => {
    console.log('Running simplified test upload...');
    
    try {
      // First check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error('Auth error:', authError);
        toast.error('Authentication required');
        return;
      }
      
      console.log('User is authenticated:', user.id);
      
      // Use a minimal base64 encoded PNG (1x1 red pixel)
      // This is a valid minimal PNG file
      const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      
      // Convert base64 to blob
      const byteCharacters = atob(base64Data);
      const byteArrays = [];
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArrays.push(byteCharacters.charCodeAt(i));
      }
      const byteArray = new Uint8Array(byteArrays);
      const blob = new Blob([byteArray], { type: 'image/png' });
      
      // Create file object
      const fileName = `simple_test_${Date.now()}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      
      console.log('Simple test file created');
      
      // Simple direct upload without extra parameters
      console.log('Uploading to storage');
      const uploadResult = await supabase.storage
        .from('floor-textures')
        .upload(fileName, file);
        
      if (uploadResult.error) {
        console.error('Upload error:', uploadResult.error);
        toast.error(`Upload failed: ${uploadResult.error.message}`);
        return;
      }
      
      console.log('Upload successful:', uploadResult.data);
      toast.success('Simple upload successful!');
      
      // Test database insert
      const dbResult = await supabase
        .from('floor_textures')
        .insert({
          name: 'Simple Test',
          description: 'Simple upload test',
          file_url: fileName,
          user_id: user.id
        })
        .select();
        
      if (dbResult.error) {
        console.error('Database error:', dbResult.error);
        toast.error(`Database insert failed: ${dbResult.error.message}`);
        return;
      }
      
      console.log('Database insert successful:', dbResult.data);
      toast.success('Complete test successful');
      
      // Refresh texture list
      await loadTextures();
      
    } catch (error) {
      console.error('Simple test error:', error);
      if (error instanceof Error) {
        toast.error(`Test failed: ${error.message}`);
      } else {
        toast.error('Test failed with unknown error');
      }
    }
  };

  // Database-only test (uploads a test image first)
  const testDatabaseOnly = async () => {
    console.log('Running database test with actual image...');
    
    try {
      // First check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('Auth error:', authError);
        toast.error(`Authentication error: ${authError.message}`);
        return;
      }
      
      if (!user) {
        toast.error('Not authenticated. Please sign in first.');
        return;
      }
      
      console.log('User is authenticated:', user.id);
      
      // Create a simple red pixel image to ensure we have a real file
      const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const byteCharacters = atob(base64Data);
      const byteArrays = [];
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArrays.push(byteCharacters.charCodeAt(i));
      }
      const byteArray = new Uint8Array(byteArrays);
      const blob = new Blob([byteArray], { type: 'image/png' });
      
      // Create file object with timestamp to avoid conflicts
      const timestamp = Date.now();
      const fileName = `db_test_${timestamp}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      
      // Upload the image first
      console.log('Uploading test image...');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('floor-textures')
        .upload(fileName, file);
        
      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error(`Upload for DB test failed: ${uploadError.message}`);
        return;
      }
      
      console.log('Test image uploaded:', fileName);
      
      // Now create a database entry with the real file
      console.log('Testing database insert with valid file...');
      
      const testRecord = {
        name: `DB Test ${timestamp}`,
        description: 'Database test with real file',
        file_url: fileName,
        user_id: user.id
      };
      
      console.log('Inserting record with data:', testRecord);
      
      const { data: insertResult, error: dbError } = await supabase
        .from('floor_textures')
        .insert(testRecord)
        .select();
      
      if (dbError) {
        console.error('Database insert failed:', dbError);
        toast.error(`Database error: ${dbError.message}`);
        return;
      }
      
      console.log('Database insert successful:', insertResult);
      toast.success('Database test successful!');
      
      // Now try to load the data to verify we can read
      await loadTextures();
      
    } catch (error) {
      console.error('Database test error:', error);
      if (error instanceof Error) {
        toast.error(`Test failed: ${error.message}`);
      } else {
        toast.error('Database test failed');
      }
    }
  };

  return (
    <Card className="viewer-card">
      <CardHeader className="pb-3">
        <CardTitle className="viewer-title">Floor Type</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={currentFloorType}
          onValueChange={(value) => onFloorTypeChange(value as FloorType)}
          className="viewer-radio-group"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="grid" id="grid" className="viewer-radio-item" />
            <Label htmlFor="grid" className="viewer-label flex items-center">
              <Grid className="viewer-button-icon" />
              Grid
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="none" id="none" className="viewer-radio-item" />
            <Label htmlFor="none" className="viewer-label flex items-center">
              <X className="viewer-button-icon" />
              None
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="textured" id="textured" className="viewer-radio-item" />
            <Label htmlFor="textured" className="viewer-label flex items-center">
              <ImageIcon className="viewer-button-icon" />
              Textured
            </Label>
          </div>
        </RadioGroup>

        {currentFloorType === 'textured' && (
          <div className="space-y-4">
            {(bucketError || tableError) && (
              <Alert variant="destructive" className="text-sm">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <div>Configuration Error</div>
                </div>
                <AlertDescription>
                  {bucketError && <div>{bucketError}</div>}
                  {tableError && <div>{tableError}</div>}
                </AlertDescription>
              </Alert>
            )}

            <ScrollArea className="h-[200px] rounded-md border">
              <div className="p-4 grid grid-cols-2 gap-2">
                {loadingTextures ? (
                  <div className="col-span-2 flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : textures.length > 0 ? (
                  textures.map((texture) => (
                    <Button
                      key={texture.id}
                      variant="secondary"
                      size="sm"
                      className={`viewer-button aspect-square p-0 overflow-hidden ${
                        selectedTextureId === texture.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => handleTextureSelect(texture)}
                    >
                      <img
                        src={texture.thumbnail_url || texture.file_url}
                        alt={texture.name}
                        className="w-full h-full object-cover"
                      />
                    </Button>
                  ))
                ) : (
                  <div className="col-span-2 text-center py-4 text-muted-foreground">
                    No textures available
                  </div>
                )}
              </div>
            </ScrollArea>

            <Button
              {...getRootProps()}
              disabled={uploadingTexture}
              className="viewer-button w-full"
            >
              <input {...getInputProps()} />
              {uploadingTexture ? (
                <>
                  <Loader2 className="viewer-button-icon animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="viewer-button-icon" />
                  Upload Texture
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 