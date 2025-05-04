// Script to verify Supabase storage setup
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Try to load environment variables from different possible locations
const possibleEnvFiles = [
  '.env.local',
  '.env',
  '../.env.local',
  '../.env',
];

let envFileFound = false;
for (const file of possibleEnvFiles) {
  const filePath = path.resolve(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    require('dotenv').config({ path: filePath });
    console.log(`Loaded environment from: ${filePath}`);
    envFileFound = true;
    break;
  }
}

if (!envFileFound) {
  console.log('Could not find .env file. Trying to use environment variables directly.');
}

// Use environment variables (either from .env or directly from process.env)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase environment variables. Please check your environment.');
  console.log('Required variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function verifyStorageSetup() {
  try {
    console.log('Connecting to Supabase with service role key...');
    
    // Create client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false }
    });
    
    // Check if thumbnails bucket exists
    console.log('Checking if thumbnails bucket exists...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.error('Error fetching buckets:', bucketError);
      return;
    }
    
    const thumbnailsBucket = buckets.find(bucket => bucket.name === 'thumbnails');
    
    if (!thumbnailsBucket) {
      console.log('❌ Thumbnails bucket not found. Creating it...');
      
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('thumbnails', {
        public: true, // Make it public so images can be viewed
        fileSizeLimit: 5242880, // 5MB limit for thumbnails
      });
      
      if (createError) {
        console.error('Failed to create thumbnails bucket:', createError);
        return;
      }
      
      console.log('✅ Created thumbnails bucket successfully');
    } else {
      console.log('✅ Thumbnails bucket exists');
      
      // Update bucket to ensure it's public
      const { error: updateError } = await supabase.storage.updateBucket('thumbnails', {
        public: true
      });
      
      if (updateError) {
        console.error('Failed to update thumbnails bucket:', updateError);
      } else {
        console.log('✅ Updated thumbnails bucket to be public');
      }
    }
    
    // Check bucket policies
    console.log('Checking storage policies...');
    
    // Create a test file to verify permissions
    const testFilePath = `test/verification-${Date.now()}.txt`;
    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(testFilePath, Buffer.from('Test file for verification'), {
        contentType: 'text/plain',
        upsert: true
      });
      
    if (uploadError) {
      console.error('❌ Failed to upload test file:', uploadError);
    } else {
      console.log('✅ Successfully uploaded test file');
      
      // Get the URL of the test file
      const { data: urlData } = await supabase.storage
        .from('thumbnails')
        .getPublicUrl(testFilePath);
        
      console.log('  Public URL:', urlData.publicUrl);
      
      // Try to access the file
      try {
        const response = await fetch(urlData.publicUrl);
        if (response.ok) {
          console.log('✅ Successfully accessed test file via public URL');
        } else {
          console.error('❌ Failed to access test file:', response.status, response.statusText);
        }
      } catch (fetchError) {
        console.error('❌ Error fetching test file:', fetchError);
      }
      
      // Clean up the test file
      await supabase.storage
        .from('thumbnails')
        .remove([testFilePath]);
      console.log('  Removed test file');
    }
    
    console.log('\nStorage Verification Complete');
  } catch (error) {
    console.error('Verification error:', error);
  }
}

verifyStorageSetup().catch(console.error); 