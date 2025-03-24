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