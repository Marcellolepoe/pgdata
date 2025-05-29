# Funeral Parlour Images

## File Naming Convention
Images should be named using lowercase letters, hyphens for spaces, and include the file extension.

## Current Image Files Needed:
Based on `funeral_services_cleaned.json`:

1. `eternal-rest-funeral-services.jpg`
2. `serenity-memorial-services.jpg` 
3. `tranquil-passage-funerals.jpg`
4. `heavenly-journey-funeral-home.jpg`

## Image Requirements:
- **Format**: JPG, PNG, or WebP
- **Recommended size**: 800x600px or 1200x900px
- **Aspect ratio**: 4:3 or 16:9
- **File size**: Under 500KB for web optimization

## How to Add Images:

### Method 1: Via GitHub Web Interface
1. Go to your GitHub repository
2. Navigate to the `images/` folder
3. Click "Add file" → "Upload files"
4. Drag and drop your images
5. Commit the changes

### Method 2: Via Git Commands
1. Copy your images to this folder locally
2. Run: `git add images/`
3. Run: `git commit -m "Add funeral parlour images"`
4. Run: `git push origin main`

## Usage in JSON:
Each funeral parlour entry should have an "Image" field pointing to the filename:
```json
{
  "Funeral Company": "Eternal Rest Funeral Services",
  "Image": "eternal-rest-funeral-services.jpg"
}
``` 