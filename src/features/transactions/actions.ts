import { toast } from '../../ui/toast';
import { setDeleted } from './queries';

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
