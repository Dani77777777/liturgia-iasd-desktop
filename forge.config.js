module.exports = {
  packagerConfig: {
    asar: true,
    icon: './build/icon', // Will use .ico for Windows, .icns for Mac
    name: 'Liturgia IASD',
    executableName: 'liturgia-iasd',
    appBundleId: 'com.liturgia-iasd.desktop',
    appCategoryType: 'public.app-category.productivity',
  },
  rebuildConfig: {},
  makers: [
    // Windows - Squirrel Installer (.exe)
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'LiturgiaIASD',
        authors: 'Liturgia IASD',
        description: 'Desktop wrapper for Liturgia IASD with multi-window projection support',
        iconUrl: 'https://liturgia-iasd.vercel.app/icon.ico', // URL to icon (required for Squirrel)
        setupIcon: './build/icon.ico',
        loadingGif: './build/icon.png', // Optional loading animation
      },
    },
    // Windows - ZIP (portable)
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
    },
    // Mac - DMG
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
        icon: './build/icon.icns',
        name: 'Liturgia IASD',
      },
    },
    // Mac - ZIP (portable)
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
  ],
};
