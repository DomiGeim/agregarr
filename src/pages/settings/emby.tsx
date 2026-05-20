import SettingsEmby from '@app/components/Settings/SettingsEmby';
import SettingsLayout from '@app/components/Settings/SettingsLayout';
import type { NextPage } from 'next';

const EmbySettingsPage: NextPage = () => {
  return (
    <SettingsLayout>
      <SettingsEmby />
    </SettingsLayout>
  );
};

export default EmbySettingsPage;
