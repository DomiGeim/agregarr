import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import globalMessages from '@app/i18n/globalMessages';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import type { MediaServerType, PlexSettings } from '@server/lib/settings';
import axios from 'axios';
import { Field, Formik } from 'formik';
import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages({
  settingsTitle: '{serverName} Settings',
  settingsDescription:
    'Configure the settings for your {serverName} server. Agregarr uses this connection to discover libraries and manage collections.',
  hostname: 'Hostname or IP Address',
  port: 'Port',
  enablessl: 'Use SSL',
  apiKey: 'API Key',
  jellyfinApiKeyTip:
    'Create an API key in Jellyfin under Dashboard > API Keys.',
  embyApiKeyTip: 'Create an API key in Emby under Settings > API Keys.',
  toastConnecting: 'Attempting to connect to {serverName}...',
  toastConnectingSuccess: '{serverName} connection established successfully!',
  toastConnectingFailure: 'Failed to connect to {serverName}.',
  toastAuthFailure:
    '{serverName} rejected the API key. Please check the key and try again.',
  toastServerFailure:
    '{serverName} is reachable, but did not return server information.',
  toastNetworkFailure:
    '{serverName} could not be reached. Please check host, port, and SSL.',
  toastSyncSuccess: '{serverName} libraries synced successfully!',
  toastActivated: '{serverName} is now the active media server.',
  testAndSync: 'Test & Sync Libraries',
  runDiagnostics: 'Run Diagnostics',
  diagnosticsPassed: 'Diagnostics passed',
  diagnosticsFailed: 'Diagnostics found issues',
  activeMediaServer: 'Active media server',
  inactiveMediaServer: 'Saved profile',
  libraries: 'Libraries',
  activate: 'Activate',
  validationHostnameRequired: 'You must provide a valid hostname or IP address',
  validationPortRequired: 'You must provide a valid port number',
  validationApiKeyRequired: 'You must provide a {serverName} API key',
});

interface SettingsMediaServerProps {
  serverType: Extract<MediaServerType, 'jellyfin' | 'emby'>;
  serverName: 'Jellyfin' | 'Emby';
  iconPath: string;
  defaultPort?: number;
}

const hostRegex =
  /^(((([a-z]|\d|_|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*)?([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])):((([a-z]|\d|_|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*)?([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))@)?(([a-z]|\d|_|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*)?([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])$/i;

const SettingsMediaServer = ({
  serverType,
  serverName,
  iconPath,
  defaultPort = 8096,
}: SettingsMediaServerProps) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnostics, setDiagnostics] = useState<{
    ok: boolean;
    baseUrl: string;
    durationMs: number;
    checks: {
      id: string;
      label: string;
      ok: boolean;
      message: string;
      durationMs?: number;
    }[];
  } | null>(null);
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<PlexSettings & { active?: boolean }>(
    `/api/v1/settings/${serverType}`
  );
  const intl = useIntl();
  const { addToast, removeToast } = useToasts();

  const format = (
    message: Parameters<typeof intl.formatMessage>[0],
    values?: Record<string, string | number>
  ) => intl.formatMessage(message, { serverName, ...values });

  const getConnectionErrorMessage = (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message;

      if (error.response?.status === 401 || error.response?.status === 403) {
        return format(messages.toastAuthFailure);
      }

      if (
        message?.toLowerCase().includes('server not found') ||
        message?.toLowerCase().includes('server information')
      ) {
        return format(messages.toastServerFailure);
      }

      if (!error.response) {
        return format(messages.toastNetworkFailure);
      }

      return message || format(messages.toastConnectingFailure);
    }

    return format(messages.toastConnectingFailure);
  };

  const SettingsSchema = Yup.object().shape({
    hostname: Yup.string()
      .nullable()
      .required(format(messages.validationHostnameRequired))
      .matches(hostRegex, format(messages.validationHostnameRequired)),
    port: Yup.number()
      .nullable()
      .required(format(messages.validationPortRequired)),
    mediaServerApiKey: Yup.string().required(
      format(messages.validationApiKeyRequired)
    ),
  });

  const syncLibraries = async () => {
    await axios.get(`/api/v1/settings/${serverType}/library`, {
      params: { sync: true },
    });
    revalidate();
  };

  const activateServer = async () => {
    await axios.post('/api/v1/settings/media-server/activate', {
      mediaServerType: serverType,
    });
    revalidate();
    addToast(format(messages.toastActivated), {
      autoDismiss: true,
      appearance: 'success',
    });
  };

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  const hasSettings = !!data?.ip;

  return (
    <>
      <PageTitle
        title={[serverName, intl.formatMessage(globalMessages.settings)]}
      />
      <div className="mb-6">
        <h3 className="heading flex items-center">
          <img src={iconPath} alt="" className="mr-2 h-7 w-7" />
          {format(messages.settingsTitle)}
        </h3>
        <p className="description">{format(messages.settingsDescription)}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-300">
          <span className="rounded-md border border-gray-600 px-3 py-2">
            {data?.active
              ? intl.formatMessage(messages.activeMediaServer)
              : intl.formatMessage(messages.inactiveMediaServer)}
          </span>
          <span className="rounded-md border border-gray-600 px-3 py-2">
            {intl.formatMessage(messages.libraries)}:{' '}
            {data?.libraries?.length || 0}
          </span>
        </div>
      </div>
      <Formik
        initialValues={{
          hostname: hasSettings ? data?.ip : '',
          port: hasSettings ? data?.port : defaultPort,
          useSsl: hasSettings ? data?.useSsl : false,
          mediaServerApiKey:
            data?.mediaServerApiKey ?? data?.jellyfinApiKey ?? '',
        }}
        validationSchema={SettingsSchema}
        onSubmit={async (values) => {
          let toastId: string | null = null;
          try {
            addToast(
              format(messages.toastConnecting),
              { autoDismiss: false, appearance: 'info' },
              (id) => {
                toastId = id;
              }
            );
            await axios.post(`/api/v1/settings/${serverType}`, {
              mediaServerType: serverType,
              ip: values.hostname,
              port: Number(values.port),
              useSsl: values.useSsl,
              mediaServerApiKey: values.mediaServerApiKey,
              jellyfinApiKey: values.mediaServerApiKey,
            } as PlexSettings);

            await syncLibraries();

            if (toastId) {
              removeToast(toastId);
            }
            addToast(format(messages.toastConnectingSuccess), {
              autoDismiss: true,
              appearance: 'success',
            });
          } catch (e) {
            if (toastId) {
              removeToast(toastId);
            }
            addToast(getConnectionErrorMessage(e), {
              autoDismiss: true,
              appearance: 'error',
            });
          }
        }}
      >
        {({
          errors,
          touched,
          values,
          handleSubmit,
          setFieldValue,
          isSubmitting,
          isValid,
        }) => (
          <form className="section" onSubmit={handleSubmit}>
            <div className="form-row">
              <label htmlFor="hostname" className="text-label">
                {intl.formatMessage(messages.hostname)}
                <span className="label-required">*</span>
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-stone-800 px-3 text-gray-100 sm:text-sm">
                    {values.useSsl ? 'https://' : 'http://'}
                  </span>
                  <Field
                    type="text"
                    inputMode="url"
                    id="hostname"
                    name="hostname"
                    className="rounded-r-only flex-1"
                  />
                </div>
                {errors.hostname &&
                  touched.hostname &&
                  typeof errors.hostname === 'string' && (
                    <div className="error">{errors.hostname}</div>
                  )}
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="port" className="text-label">
                {intl.formatMessage(messages.port)}
                <span className="label-required">*</span>
              </label>
              <div className="form-input-area">
                <Field
                  type="text"
                  inputMode="numeric"
                  id="port"
                  name="port"
                  className="short"
                />
                {errors.port &&
                  touched.port &&
                  typeof errors.port === 'string' && (
                    <div className="error">{errors.port}</div>
                  )}
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="ssl" className="checkbox-label">
                {intl.formatMessage(messages.enablessl)}
              </label>
              <div className="form-input-area">
                <Field
                  type="checkbox"
                  id="useSsl"
                  name="useSsl"
                  onChange={() => {
                    setFieldValue('useSsl', !values.useSsl);
                  }}
                />
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="mediaServerApiKey" className="text-label">
                {intl.formatMessage(messages.apiKey)}
                <span className="label-required">*</span>
                <span className="label-tip">
                  {serverType === 'emby'
                    ? intl.formatMessage(messages.embyApiKeyTip)
                    : intl.formatMessage(messages.jellyfinApiKeyTip)}
                </span>
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field
                    type="password"
                    id="mediaServerApiKey"
                    name="mediaServerApiKey"
                  />
                </div>
                {errors.mediaServerApiKey &&
                  touched.mediaServerApiKey &&
                  typeof errors.mediaServerApiKey === 'string' && (
                    <div className="error">{errors.mediaServerApiKey}</div>
                  )}
              </div>
            </div>
            {diagnostics && (
              <div className="form-row">
                <span className="text-label">
                  {intl.formatMessage(messages.runDiagnostics)}
                </span>
                <div className="form-input-area">
                  <div className="rounded-md border border-gray-700 bg-stone-900 p-3 text-sm">
                    <p
                      className={
                        diagnostics.ok ? 'text-green-300' : 'text-orange-300'
                      }
                    >
                      {intl.formatMessage(
                        diagnostics.ok
                          ? messages.diagnosticsPassed
                          : messages.diagnosticsFailed
                      )}{' '}
                      ({diagnostics.durationMs} ms)
                    </p>
                    <div className="mt-2 space-y-2">
                      {diagnostics.checks.map((check) => (
                        <div
                          key={check.id}
                          className="flex flex-col gap-1 rounded border border-gray-800 px-3 py-2"
                        >
                          <span
                            className={
                              check.ok ? 'text-green-300' : 'text-orange-300'
                            }
                          >
                            {check.label}
                            {check.durationMs
                              ? ` (${check.durationMs} ms)`
                              : ''}
                          </span>
                          <span className="text-gray-400">
                            {check.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="actions">
              <div className="flex justify-end">
                <span className="ml-3 inline-flex rounded-md shadow-sm">
                  {!data?.active && (
                    <Button
                      buttonType="default"
                      type="button"
                      disabled={!data?.ip || isSubmitting}
                      onClick={(e) => {
                        e.preventDefault();
                        activateServer();
                      }}
                    >
                      {intl.formatMessage(messages.activate)}
                    </Button>
                  )}
                </span>
                <span className="ml-3 inline-flex rounded-md shadow-sm">
                  <Button
                    buttonType="default"
                    type="button"
                    disabled={
                      isDiagnosing ||
                      !values.hostname ||
                      !values.mediaServerApiKey
                    }
                    onClick={async (e) => {
                      e.preventDefault();
                      setIsDiagnosing(true);
                      try {
                        const response = await axios.post(
                          '/api/v1/settings/media-server/diagnostics',
                          {
                            mediaServerType: serverType,
                            ip: values.hostname,
                            port: Number(values.port),
                            useSsl: values.useSsl,
                            mediaServerApiKey: values.mediaServerApiKey,
                          }
                        );
                        setDiagnostics(response.data);
                      } catch (error) {
                        addToast(getConnectionErrorMessage(error), {
                          autoDismiss: true,
                          appearance: 'error',
                        });
                      } finally {
                        setIsDiagnosing(false);
                      }
                    }}
                  >
                    {isDiagnosing
                      ? intl.formatMessage(globalMessages.saving)
                      : intl.formatMessage(messages.runDiagnostics)}
                  </Button>
                </span>
                <span className="ml-3 inline-flex rounded-md shadow-sm">
                  <Button
                    buttonType="default"
                    type="button"
                    disabled={!values.hostname || !values.mediaServerApiKey}
                    onClick={async (e) => {
                      e.preventDefault();
                      setIsSyncing(true);
                      try {
                        await syncLibraries();
                        addToast(format(messages.toastSyncSuccess), {
                          autoDismiss: true,
                          appearance: 'success',
                        });
                      } catch (error) {
                        addToast(getConnectionErrorMessage(error), {
                          autoDismiss: true,
                          appearance: 'error',
                        });
                      } finally {
                        setIsSyncing(false);
                      }
                    }}
                  >
                    {isSyncing
                      ? intl.formatMessage(globalMessages.saving)
                      : intl.formatMessage(messages.testAndSync)}
                  </Button>
                </span>
                <span className="ml-3 inline-flex rounded-md shadow-sm">
                  <Button
                    buttonType="primary"
                    type="submit"
                    disabled={isSubmitting || !isValid}
                  >
                    <ArrowDownOnSquareIcon />
                    <span>
                      {isSubmitting
                        ? intl.formatMessage(globalMessages.saving)
                        : intl.formatMessage(globalMessages.save)}
                    </span>
                  </Button>
                </span>
              </div>
            </div>
          </form>
        )}
      </Formik>
    </>
  );
};

export default SettingsMediaServer;
