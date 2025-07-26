# Security Implementation

## API Key Management

This project uses sensitive API keys that must be protected from version control exposure.

### Setup Instructions

1. **Copy the configuration template:**
   ```bash
   cp config.example.js config.js
   ```

2. **Replace placeholder values in `config.js` with your actual API keys:**
   - Firebase configuration
   - Google Custom Search API key
   - EmailJS user ID

3. **Never commit `config.js` to version control** - it's already included in `.gitignore`

### Protected APIs

The following sensitive information is now protected:
- Firebase API keys and configuration
- Google Custom Search API key
- EmailJS configuration

### Files Updated

- `index.html` - Updated to use config object
- `script.js` - Updated Google Search API and Firebase configs
- `admin.html` - Updated Firebase configuration
- `.gitignore` - Added config.js to prevent accidental commits
- `config.example.js` - Template for developers

### For Developers

When setting up this project locally:
1. Ensure you have `config.js` with valid API keys
2. Never commit your `config.js` file
3. Use `config.example.js` as a reference for required values

### Security Best Practices

- All API keys are now stored in a single, gitignored file
- No hardcoded credentials remain in the codebase
- Template file available for easy setup 