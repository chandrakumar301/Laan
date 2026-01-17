# Environment Variables & Deployment Configuration

## Production Environment Variables for Vercel

Add these to your Vercel dashboard under **Settings → Environment Variables**:

```
VITE_SUPABASE_PROJECT_ID=tvojblmaoxbdyivsoqcw
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_1DV2tk3NfkkYsEbWpxg0RQ_P-8fjSjG
VITE_SUPABASE_URL=https://tvojblmaoxbdyivsoqcw.supabase.co
VITE_API_BASE_URL=https://your-backend-url.onrender.com
VITE_SOCKET_URL=https://your-backend-url.onrender.com
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXX
ADMIN_EMAIL=edufund0099@gmail.com
```

## Production Environment Variables for Render (Backend)

Add these to your Render backend under **Environment**:

```
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_URL=https://tvojblmaoxbdyivsoqcw.supabase.co
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXX
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ADMIN_EMAIL=edufund0099@gmail.com
NODE_ENV=production
PORT=4000
```

## SEO-Related Environment Variables

For production deployment, ensure:

1. **Vercel → Settings → Domains**
   - Primary Domain: `your-domain.com`
   - Add `www.your-domain.com` as alias
   - Enable HTTPS (automatic)

2. **Frontend URLs**
   - Homepage: `https://your-domain.com`
   - Sitemap: `https://your-domain.com/sitemap.xml`
   - Robots: `https://your-domain.com/robots.txt`

3. **Backend URLs**
   - API: `https://your-backend-url.onrender.com`
   - CORS Origins: Include your Vercel domain

## Vercel Configuration Check

- [x] Auto-deploys from Git enabled
- [x] Build command: `npm run build`
- [x] Output directory: `dist`
- [x] Environment variables set
- [x] Custom domain configured
- [x] HTTPS enabled
- [x] Automatic previews enabled

## Render Backend Configuration Check

- [x] Auto-deploys from Git enabled
- [x] Build command: `npm install`
- [x] Start command: `npm run start:server`
- [x] Environment variables set
- [x] CORS configured for your domain
- [x] Node.js version: 18+

## Next Step: Deploy

After updating all `your-domain.com` references:

```bash
git add .
git commit -m "feat: SEO configuration - robots, sitemap, meta tags"
git push origin main
```

Vercel and Render will auto-deploy and your site will be indexed!
