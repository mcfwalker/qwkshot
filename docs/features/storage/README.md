# Storage Security Configuration

## Overview
This document outlines the security configuration for Supabase storage buckets in the Modern 3D Viewer application.

## Current Status
Last Updated: March 23, 2025

### Security Configuration Issues
- Current configuration allows broader access than appropriate for production
- Temporary configuration allows unauthenticated users to upload to `floor-textures` bucket

### Required Changes Before Production
- Implement proper [authentication checks](../auth/README.md)
- Add user-specific restrictions
- Implement file type restrictions
- Consider folder structures for uploads

## Current Issue

The application currently has security configuration issues with Supabase storage buckets. We've identified that while database Row Level Security (RLS) policies are correctly configured, the storage bucket policies have been temporarily set to allow broader access than would be appropriate for production.

## Temporary Configuration

For development and testing purposes, we've implemented the following storage bucket policy:

```sql
CREATE POLICY "Allow anyone to upload files" 
ON storage.objects 
FOR INSERT
WITH CHECK (
  bucket_id = 'floor-textures' 
  AND true
);
```

This policy allows any user (even unauthenticated ones) to upload files to the storage bucket.

## Required Changes Before Production

Before deploying to production, the following changes must be made:

1. **Implement proper authentication checks for all storage buckets**:
   ```sql
   -- For floor-textures bucket
   CREATE POLICY "Allow authenticated users to upload files" 
   ON storage.objects 
   FOR INSERT
   WITH CHECK (
     bucket_id = 'floor-textures' 
     AND auth.role() = 'authenticated'
   );
   
   -- For model uploads bucket
   CREATE POLICY "Allow authenticated users to upload model files" 
   ON storage.objects 
   FOR INSERT
   WITH CHECK (
     bucket_id = 'models' 
     AND auth.role() = 'authenticated'
   );
   
   -- Repeat for other buckets
   ```

2. **Add user-specific restrictions where appropriate**:
   ```sql
   -- Example: Restrict users to only see their own uploads
   CREATE POLICY "Allow users to access their own files"
   ON storage.objects
   FOR SELECT
   USING (
     bucket_id = 'floor-textures'
     AND (storage.foldername(name))[1] = auth.uid()::text
   );
   ```

3. **Implement file type restrictions**:
   - Ensure each bucket only allows appropriate file types
   - Set appropriate file size limits

4. **Consider implementing folder structures**:
   - Organize uploads by user ID for better access control
   - Consider prefixing uploads with user ID to restrict access

## Additional Security Considerations

1. **Audit current storage policies** for all buckets in the system
2. **Implement malware scanning** for uploaded files if necessary
3. **Set up monitoring and alerts** for unusual upload patterns
4. **Enable object expiration** for temporary files
5. **Implement CORS policies** to prevent unauthorized domains from accessing resources

## Related Storage Buckets

This issue affects all storage buckets in the application:
- `floor-textures` - For floor texture images
- `models` - For 3D model uploads
- Any other buckets implemented in the future

## Implementation Timeline

Security policy updates should be completed before the application is deployed to production or made available to end-users.

## Related Documentation
- [Authentication Documentation](../auth/README.md)
- [Technical Debt](../../TECHNICAL_DEBT.md)
- [Development Setup](../../DEVELOPMENT_SETUP.md)

---

*Last updated: March 23, 2025*

# Storage Management

## Overview
Modern 3D Viewer uses Supabase Storage for managing 3D model files. This document outlines the best practices and implementation patterns for handling file storage and access.

## URL Handling Best Practices

### Signed URLs
The recommended approach for accessing stored files is using signed URLs:

```typescript
// Example of correct URL handling
const { data: urlData } = await supabase
  .storage
  .from('models')
  .createSignedUrl(filePath, 3600); // 1 hour expiration

const signedUrl = urlData.signedUrl;
```

#### Benefits
- Secure, temporary access
- Automatic URL encoding
- Built-in authentication
- Compatible with RLS policies
- Consistent across storage providers

#### Use Cases
- Model viewing
- File downloads
- Temporary access sharing
- Authenticated access to private files

### Anti-patterns to Avoid
```typescript
// ❌ Don't construct storage URLs manually
const url = `${SUPABASE_URL}/storage/v1/object/public/${path}`;

// ❌ Don't use direct public URLs without signing
model.file_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/...`;
```

## Implementation Guide

### 1. File Upload
```typescript
const { data } = await supabase.storage
  .from('models')
  .upload(path, file);
```

### 2. File Access
```typescript
// Get a signed URL for temporary access
const { data } = await supabase.storage
  .from('models')
  .createSignedUrl(path, 3600);
```

### 3. File Deletion
```typescript
const { error } = await supabase.storage
  .from('models')
  .remove([path]);
```

## Current Implementation Status

### Working Examples
- Library model selector (`src/components/viewer/LibraryModelSelector.tsx`)
- Model loading service (`src/lib/library-service.ts`)

### Needs Update
- Direct model viewing (`src/app/(protected)/viewer/[modelId]/page.tsx`)
- Any direct public URL construction

## Migration Guide
When updating existing code to use signed URLs:
1. Replace direct URL construction with `createSignedUrl`
2. Update components to handle URL expiration
3. Consider caching strategies for frequently accessed files
4. Implement error handling for URL generation failures

## Security Considerations
- Signed URLs expire after their specified duration
- Each signed URL is unique and cannot be modified
- Access can be revoked by updating storage bucket policies
- URLs should not be stored long-term in the database 