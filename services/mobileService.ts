
import { App as CapApp } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { NavigationBar } from '@capgo/capacitor-navigation-bar';

let immersiveSetup = false;

export const setupMobile = async (currentView: string, setView: (v: any) => void) => {
  // App Exit / Back Logic
  CapApp.removeAllListeners();
  CapApp.addListener('backButton', ({ canGoBack }) => {
    if (currentView !== 'SHELF') {
      setView('SHELF');
    } else {
      CapApp.exitApp();
    }
  });

  // Full Screen / Immersive Mode - Complete Coverage
  if (!immersiveSetup) {
    try {
      // Hide Status Bar completely (battery, clock, etc.)
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.hide();
      await StatusBar.setStyle({ style: Style.Dark });
      
      // Hide Navigation Bar (bottom soft keys) completely
      await NavigationBar.hide();
      await NavigationBar.setColor({ color: '#000000', darkButtons: false });
      
      immersiveSetup = true;
    } catch (e) {
      console.warn("Mobile UI adjustment failed or not on mobile device", e);
    }
  }

  // Re-enforce immersive on every view change
  try {
    await StatusBar.hide();
    await NavigationBar.hide();
  } catch (e) {
    // Silently fail on non-mobile
  }
};

// Lightweight haptic - optimized for weak devices
let lastHapticTime = 0;
export const triggerHaptic = async () => {
  const now = Date.now();
  // Throttle haptic to prevent performance issues on weak phones
  if (now - lastHapticTime < 100) return;
  lastHapticTime = now;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {
    // Fail silently if not on mobile
  }
};
