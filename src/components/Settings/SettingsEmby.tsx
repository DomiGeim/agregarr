import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import globalMessages from '@app/i18n/globalMessages';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import type { PlexSettings } from '@server/lib/settings';
import axios from 'axios';
import { Field, Formik } from 'formik';
import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages({
  emby: 'Emby',
  embysettings: 'Emby Settings',
  embysettingsDescription:
    'Configure the settings for your Emby server. Agregarr uses this connection to discover libraries and manage collections.',
  hostname: 'Hostname or IP Address',
  port: 'Port',
  enablessl: 'Use SSL',
  embyApiKey: 'API Key',
  embyApiKeyTip: 'Create an API key in Emby under Settings > API Keys.',
  toastEmbyConnecting: 'Attempting to connect to Emby...',
  toastEmbyConnectingSuccess: 'Emby connection established successfully!',
  toastEmbyConnectingFailure: 'Failed to connect to Emby.',
  toastEmbyAuthFailure:
    'Emby rejected the API key. Please check the key and try again.',
  toastEmbyServerFailure:
    'Emby is reachable, but did not return server information.',
  toastEmbyNetworkFailure:
    'Emby could not be reached. Please check host, port, and SSL.',
  toastEmbySyncSuccess: 'Emby libraries synced successfully!',
  toastEmbySyncFailure: 'Failed to sync Emby libraries.',
  toastEmbyActivated: 'Emby is now the active media server.',
  testAndSync: 'Test & Sync Libraries',
  activeMediaServer: 'Active media server',
  inactiveMediaServer: 'Saved profile',
  libraries: 'Libraries',
  activate: 'Activate',
  validationHostnameRequired: 'You must provide a valid hostname or IP address',
  validationPortRequired: 'You must provide a valid port number',
  validationEmbyApiKeyRequired: 'You must provide an Emby API key',
});

const SettingsEmby = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<PlexSettings & { active?: boolean }>('/api/v1/settings/emby');
  const intl = useIntl();
  const { addToast, removeToast } = useToasts();

  const getEmbyErrorMessage = (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message;

      if (error.response?.status === 401 || error.response?.status === 403) {
        return intl.formatMessage(messages.toastEmbyAuthFailure);
      }

      if (
        message?.toLowerCase().includes('server not found') ||
        message?.toLowerCase().includes('server information')
      ) {
        return intl.formatMessage(messages.toastEmbyServerFailure);
      }

      if (!error.response) {
        return intl.formatMessage(messages.toastEmbyNetworkFailure);
      }

      return message || intl.formatMessage(messages.toastEmbyConnectingFailure);
    }

    return intl.formatMessage(messages.toastEmbyConnectingFailure);
  };

  const EmbySettingsSchema = Yup.object().shape({
    hostname: Yup.string()
      .nullable()
      .required(intl.formatMessage(messages.validationHostnameRequired))
      .matches(
        /^(((([a-z]|\d|_|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*)?([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])):((([a-z]|\d|_|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*)?([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))@)?(([a-z]|\d|_|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*)?([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])$/i,
        intl.formatMessage(messages.validationHostnameRequired)
      ),
    port: Yup.number()
      .nullable()
      .required(intl.formatMessage(messages.validationPortRequired)),
    embyApiKey: Yup.string().required(
      intl.formatMessage(messages.validationEmbyApiKeyRequired)
    ),
  });

  const syncLibraries = async () => {
    await axios.get('/api/v1/settings/emby/library', {
      params: { sync: true },
    });
    revalidate();
  };

  const activateEmby = async () => {
    await axios.post('/api/v1/settings/media-server/activate', {
      mediaServerType: 'emby',
    });
    revalidate();
    addToast(intl.formatMessage(messages.toastEmbyActivated), {
      autoDismiss: true,
      appearance: 'success',
    });
  };

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  const hasEmbySettings = !!data?.ip;

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.emby),
          intl.formatMessage(globalMessages.settings),
        ]}
      />
      <div className="mb-6">
        <h3 className="heading flex items-center">
          <img src="/services/emby.svg" alt="" className="mr-2 h-7 w-7" />
          {intl.formatMessage(messages.embysettings)}
        </h3>
        <p className="description">
          {intl.formatMessage(messages.embysettingsDescription)}
        </p>
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
          hostname: hasEmbySettings ? data?.ip : '',
          port: hasEmbySettings ? data?.port : 8096,
          useSsl: hasEmbySettings ? data?.useSsl : false,
          embyApiKey: data?.jellyfinApiKey ?? '',
        }}
        validationSchema={EmbySettingsSchema}
        onSubmit={async (values) => {
          let toastId: string | null = null;
          try {
            addToast(
              intl.formatMessage(messages.toastEmbyConnecting),
              { autoDismiss: false, appearance: 'info' },
              (id) => {
                toastId = id;
              }
            );
            await axios.post('/api/v1/settings/emby', {
              mediaServerType: 'emby',
              ip: values.hostname,
              port: Number(values.port),
              useSsl: values.useSsl,
              jellyfinApiKey: values.embyApiKey,
            } as PlexSettings);

            await syncLibraries();

            if (toastId) {
              removeToast(toastId);
            }
            addToast(intl.formatMessage(messages.toastEmbyConnectingSuccess), {
              autoDismiss: true,
              appearance: 'success',
            });
          } catch (e) {
            if (toastId) {
              removeToast(toastId);
            }
            addToast(getEmbyErrorMessage(e), {
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
                  onChange={() => setFieldValue('useSsl', !values.useSsl)}
                />
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="embyApiKey" className="text-label">
                {intl.formatMessage(messages.embyApiKey)}
                <span className="label-required">*</span>
                <span className="label-tip">
                  {intl.formatMessage(messages.embyApiKeyTip)}
                </span>
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field type="password" id="embyApiKey" name="embyApiKey" />
                </div>
                {errors.embyApiKey &&
                  touched.embyApiKey &&
                  typeof errors.embyApiKey === 'string' && (
                    <div className="error">{errors.embyApiKey}</div>
                  )}
              </div>
            </div>
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
                        activateEmby();
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
                    disabled={!values.hostname || !values.embyApiKey}
                    onClick={async (e) => {
                      e.preventDefault();
                      setIsSyncing(true);
                      try {
                        await syncLibraries();
                        addToast(
                          intl.formatMessage(messages.toastEmbySyncSuccess),
                          {
                            autoDismiss: true,
                            appearance: 'success',
                          }
                        );
                      } catch (error) {
                        addToast(getEmbyErrorMessage(error), {
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

export default SettingsEmby;
