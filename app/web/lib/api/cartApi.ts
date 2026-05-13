import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { getOperationalSession } from '../operationalSession';

export const saveCartLocation = async (cartCode: string, position: string, description: string) => {
  const callable = httpsCallable(functions, 'cartOperate');
  const result = await callable({
    payload: { cartCode, position, description },
    session: getOperationalSession(),
  });
  return (result?.data || {}) as { ok?: boolean };
};
