import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'cloudcertprep',
  webDir: 'dist/cloudcertprep/browser',
  plugins: {
    CapacitorSQLite: {
      // The app stores plain SQLite data; encryption would add a keystore
      // dependency at plugin load that is not needed.
      androidIsEncryption: false,
      iosIsEncryption: false
    }
  }
};

export default config;
