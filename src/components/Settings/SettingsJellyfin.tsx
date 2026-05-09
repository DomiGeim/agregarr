import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import globalMessages from '@app/i18n/globalMessages';
import {
  ArrowDownOnSquareIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline';
import type { PlexSettings } from '@server/lib/settings';
import axios from 'axios';
import { Field, Formik } from 'formik';
import { defineMessages, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages({
  jellyfin: 'Jellyfin',
  jellyfinsettings: 'Jellyfin Settings',
  jellyfinsettingsDescription:
    'Configure the settings for your Jellyfin server. Agregarr uses this connection to discover libraries and manage collections.',
  hostname: 'Hostname or IP Address',
  port: 'Port',
  enablessl: 'Use SSL',
  jellyfinApiKey: 'API Key',
  jellyfinApiKeyTip:
    'Create an API key in Jellyfin under Dashboard > API Keys.',
  toastJellyfinConnecting: 'Attempting to connect to Jellyfin...',
  toastJellyfinConnectingSuccess:
    'Jellyfin connection established successfully!',
  toastJellyfinConnectingFailure: 'Failed to connect to Jellyfin.',
  validationHostnameRequired: 'You must provide a valid hostname or IP address',
  validationPortRequired: 'You must provide a valid port number',
  validationApiKeyRequired: 'You must provide a Jellyfin API key',
});

interface Library {
  key: string;
  name: string;
}

interface SyncStatus {
  running: boolean;
  progress: number;
  total: number;
  currentLibrary?: Library;
  libraries: Library[];
}

const SettingsJellyfin = () => {
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<PlexSettings>('/api/v1/settings/plex');

  useSWR<SyncStatus>('/api/v1/settings/plex/sync', {
    refreshInterval: 1000,
  });

  const intl = useIntl();
  const { addToast, removeToast } = useToasts();

  const JellyfinSettingsSchema = Yup.object().shape({
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
    jellyfinApiKey: Yup.string().required(
      intl.formatMessage(messages.validationApiKeyRequired)
    ),
  });

  const syncLibraries = async () => {
    await axios.get('/api/v1/settings/plex/library', {
      params: {
        sync: true,
      },
    });
    revalidate();
  };

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  const hasJellyfinSettings = data?.mediaServerType === 'jellyfin';

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.jellyfin),
          intl.formatMessage(globalMessages.settings),
        ]}
      />
      <div className="mb-6">
        <h3 className="heading flex items-center">
          <ServerStackIcon className="mr-2 h-7 w-7 text-indigo-300" />
          {intl.formatMessage(messages.jellyfinsettings)}
        </h3>
        <p className="description">
          {intl.formatMessage(messages.jellyfinsettingsDescription)}
        </p>
      </div>
      <Formik
        initialValues={{
          hostname: hasJellyfinSettings ? data?.ip : '',
          port: hasJellyfinSettings ? data?.port : 8096,
          useSsl: hasJellyfinSettings ? data?.useSsl : false,
          jellyfinApiKey: data?.jellyfinApiKey ?? '',
        }}
        validationSchema={JellyfinSettingsSchema}
        onSubmit={async (values) => {
          let toastId: string | null = null;
          try {
            addToast(
              intl.formatMessage(messages.toastJellyfinConnecting),
              {
                autoDismiss: false,
                appearance: 'info',
              },
              (id) => {
                toastId = id;
              }
            );
            await axios.post('/api/v1/settings/plex', {
              mediaServerType: 'jellyfin',
              ip: values.hostname,
              port: Number(values.port),
              useSsl: values.useSsl,
              jellyfinApiKey: values.jellyfinApiKey,
            } as PlexSettings);

            await syncLibraries();

            if (toastId) {
              removeToast(toastId);
            }
            addToast(
              intl.formatMessage(messages.toastJellyfinConnectingSuccess),
              {
                autoDismiss: true,
                appearance: 'success',
              }
            );
          } catch (e) {
            if (toastId) {
              removeToast(toastId);
            }
            addToast(
              intl.formatMessage(messages.toastJellyfinConnectingFailure),
              {
                autoDismiss: true,
                appearance: 'error',
              }
            );
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
        }) => {
          return (
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
                <label htmlFor="jellyfinApiKey" className="text-label">
                  {intl.formatMessage(messages.jellyfinApiKey)}
                  <span className="label-required">*</span>
                  <span className="label-tip">
                    {intl.formatMessage(messages.jellyfinApiKeyTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      type="password"
                      id="jellyfinApiKey"
                      name="jellyfinApiKey"
                    />
                  </div>
                  {errors.jellyfinApiKey &&
                    touched.jellyfinApiKey &&
                    typeof errors.jellyfinApiKey === 'string' && (
                      <div className="error">{errors.jellyfinApiKey}</div>
                    )}
                </div>
              </div>
              <div className="actions">
                <div className="flex justify-end">
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
          );
        }}
      </Formik>
    </>
  );
};

export default SettingsJellyfin;
