import { useEffect, useState, useCallback } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { Download, RefreshCw, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface UpdateInfo {
  version: string;
  currentVersion: string;
  body?: string;
}

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error' | 'up-to-date';

export function UpdateChecker() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const checkForUpdates = useCallback(async (silent = false) => {
    try {
      setStatus('checking');
      setError(null);
      
      const update = await check();
      
      if (update) {
        setUpdateInfo({
          version: update.version,
          currentVersion: update.currentVersion,
          body: update.body,
        });
        setStatus('available');
        setDismissed(false);
      } else {
        setStatus('up-to-date');
        if (!silent) {
          // Show "up to date" message briefly
          setTimeout(() => setStatus('idle'), 3000);
        } else {
          setStatus('idle');
        }
      }
    } catch (err) {
      console.error('Update check failed:', err);
      setError(err instanceof Error ? err.message : 'Update check failed');
      setStatus('error');
      if (silent) {
        // Don't show error for silent checks
        setStatus('idle');
      }
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    try {
      setStatus('downloading');
      setProgress(0);
      
      const update = await check();
      if (!update) {
        setStatus('idle');
        return;
      }

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case 'Finished':
            setProgress(100);
            break;
        }
      });

      setStatus('ready');
    } catch (err) {
      console.error('Download failed:', err);
      setError(err instanceof Error ? err.message : 'Download failed');
      setStatus('error');
    }
  }, []);

  const handleRelaunch = useCallback(async () => {
    await relaunch();
  }, []);

  // Check for updates on mount (silent)
  useEffect(() => {
    // Delay initial check to avoid slowing down app startup
    const timer = setTimeout(() => {
      checkForUpdates(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  // Don't render anything if dismissed or idle
  if (dismissed || status === 'idle') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {status === 'checking' && (
              <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
            )}
            {status === 'available' && (
              <Download className="w-5 h-5 text-blue-500" />
            )}
            {status === 'downloading' && (
              <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
            )}
            {status === 'ready' && (
              <CheckCircle className="w-5 h-5 text-green-500" />
            )}
            {status === 'up-to-date' && (
              <CheckCircle className="w-5 h-5 text-green-500" />
            )}
            {status === 'error' && (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <span className="font-medium text-gray-900 dark:text-white">
              {status === 'checking' && t('update.checking', 'Checking for updates...')}
              {status === 'available' && t('update.available', 'Update Available')}
              {status === 'downloading' && t('update.downloading', 'Downloading...')}
              {status === 'ready' && t('update.ready', 'Ready to Install')}
              {status === 'up-to-date' && t('update.upToDate', 'Up to date!')}
              {status === 'error' && t('update.error', 'Update Error')}
            </span>
          </div>
          {(status === 'available' || status === 'error') && (
            <button
              onClick={() => setDismissed(true)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        {status === 'available' && updateInfo && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('update.newVersion', 'Version {{version}} is available', { version: updateInfo.version })}
              <span className="text-xs ml-1">
                ({t('update.current', 'current')}: {updateInfo.currentVersion})
              </span>
            </p>
            {updateInfo.body && (
              <div className="text-xs text-gray-500 dark:text-gray-400 max-h-20 overflow-y-auto">
                {updateInfo.body}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={downloadAndInstall}
                className="flex-1 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
              >
                {t('update.downloadInstall', 'Download & Install')}
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="px-3 py-1.5 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                {t('update.later', 'Later')}
              </button>
            </div>
          </div>
        )}

        {status === 'downloading' && (
          <div className="space-y-2">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {progress}%
            </p>
          </div>
        )}

        {status === 'ready' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('update.restartPrompt', 'Update downloaded. Restart to apply changes.')}
            </p>
            <button
              onClick={handleRelaunch}
              className="w-full px-3 py-1.5 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors"
            >
              {t('update.restartNow', 'Restart Now')}
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-2">
            <p className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
            <button
              onClick={() => checkForUpdates(false)}
              className="text-sm text-blue-500 hover:underline"
            >
              {t('update.tryAgain', 'Try again')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Hook for manual update checking
export function useUpdateChecker() {
  const [isChecking, setIsChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    setIsChecking(true);
    try {
      const update = await check();
      if (update) {
        setUpdateAvailable(true);
        setVersion(update.version);
        return { available: true, version: update.version };
      }
      setUpdateAvailable(false);
      return { available: false };
    } catch (err) {
      console.error('Update check failed:', err);
      return { available: false, error: err };
    } finally {
      setIsChecking(false);
    }
  }, []);

  return {
    isChecking,
    updateAvailable,
    version,
    checkForUpdates,
  };
}
