# Fix Google OAuth Branding

The Google sign-in popup shows "mnjojpflcadceewqbsnz.supabase.co" as the requesting app.
To show "Life HUD" instead:

1. Go to Google Cloud Console: https://console.cloud.google.com
2. Select the project used for OAuth
3. Go to APIs & Services → OAuth consent screen
4. Update "App name" to "Life HUD"
5. Update "App logo" to the Life HUD logo
6. Update "Application home page" to https://lifehud.vercel.app
7. Save changes

This changes what users see in the Google sign-in popup.
Google may take a few hours to propagate the change.
