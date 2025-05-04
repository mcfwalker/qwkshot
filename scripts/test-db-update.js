// Script to test database updates for model thumbnails
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

// Prompt for model ID
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

// Ask for the model ID
readline.question('Enter the model ID to test: ', async (modelId) => {
  try {
    console.log(`Testing database update for model ID: ${modelId}`);
    
    // Create client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false }
    });
    
    // First check if the model exists
    console.log('Checking if model exists...');
    const { data: model, error: fetchError } = await supabase
      .from('models')
      .select('*')
      .eq('id', modelId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching model:', fetchError);
      readline.close();
      return;
    }
    
    if (!model) {
      console.error(`Model with ID ${modelId} not found.`);
      readline.close();
      return;
    }
    
    console.log('Model found:', {
      id: model.id,
      name: model.name,
      current_thumbnail: model.thumbnail_url
    });
    
    // Create a test thumbnail URL
    const testThumbnailUrl = `https://mmoqqgsamsewsbocqxbi.supabase.co/storage/v1/object/public/thumbnails/test/test-thumbnail-${Date.now()}.png`;
    
    // Update the model record with a test thumbnail URL
    console.log(`Updating model with test thumbnail URL: ${testThumbnailUrl}`);
    const { data: updateData, error: updateError } = await supabase
      .from('models')
      .update({ thumbnail_url: testThumbnailUrl })
      .eq('id', modelId)
      .select();
    
    if (updateError) {
      console.error('Error updating model:', updateError);
      readline.close();
      return;
    }
    
    console.log('✅ Database update successful!');
    console.log('Updated model:', updateData[0]);
    
    // Verify the update
    console.log('Verifying update...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('models')
      .select('thumbnail_url')
      .eq('id', modelId)
      .single();
    
    if (verifyError) {
      console.error('Error verifying update:', verifyError);
    } else {
      console.log('Verified thumbnail URL:', verifyData.thumbnail_url);
      
      if (verifyData.thumbnail_url === testThumbnailUrl) {
        console.log('✅ Verification successful! The database update is working correctly.');
      } else {
        console.error('❌ Verification failed! The database update did not persist.');
      }
    }
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    readline.close();
  }
}); 