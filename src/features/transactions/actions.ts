import { toast } from '../../ui/toast';
import { setGroupDeleted } from './create';
import { setDeleted } from './queries';
import { useTxSheet } from './store';

export async function deleteWithUndo(id: string): Promise<void> {
  try {
    await setDeleted(id, 1);
  } catch (err) {
    console.error(err);
    toast('No se pudo borrar. Probá de nuevo.');
    return;
  }
  toast('Movimiento borrado', {
    label: 'Deshacer',
    onClick: () => void setDeleted(id, 0),
  });
}

export async function deleteGroupWithUndo(groupId: string): Promise<void> {
  try {
    await setGroupDeleted(groupId, 1);
  } catch (err) {
    console.error(err);
    toast('No se pudo borrar. Probá de nuevo.');
    return;
  }
  toast('Compra en cuotas borrada', {
    label: 'Deshacer',
    onClick: () => void setGroupDeleted(groupId, 0),
  });
}

/** Stable handlers for memoized rows. */
export const deleteTx = (id: string) => void deleteWithUndo(id);
export const editTx = (id: string) => useTxSheet.getState().openEdit(id);
