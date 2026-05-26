import eventBus from './EventBus';

export interface DialogRequest {
  id: string;
  type: 'alert' | 'confirm';
  title?: string;
  message: string;
  onResolve: (value: boolean) => void;
}

let nextId = 0;

/**
 * Custom stylized non-blocking replacements for native window.alert and window.confirm.
 */
export const showAlert = (message: string, title?: string): Promise<void> => {
  return new Promise<void>((resolve) => {
    const id = `dialog-${nextId++}`;
    eventBus.emit('SHOW_DIALOG', {
      id,
      type: 'alert',
      title: title || 'Notification',
      message,
      onResolve: () => {
        resolve();
      },
    } as DialogRequest);
  });
};

export const showConfirm = (message: string, title?: string): Promise<boolean> => {
  return new Promise<boolean>((resolve) => {
    const id = `dialog-${nextId++}`;
    eventBus.emit('SHOW_DIALOG', {
      id,
      type: 'confirm',
      title: title || 'Confirmation Required',
      message,
      onResolve: (approved: boolean) => {
        resolve(approved);
      },
    } as DialogRequest);
  });
};

const dialogService = {
  showAlert,
  showConfirm,
};

export default dialogService;
