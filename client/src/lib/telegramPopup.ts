type PopupBtnType = 'default' | 'ok' | 'close' | 'cancel' | 'destructive';

export type PopupButton = {
  id: string;
  text: string;
  type?: PopupBtnType;
};

export function showAlert(message: string, title?: string): Promise<void> {
  return new Promise((resolve) => {
    const tg = window.Telegram?.WebApp;
    if (tg?.showAlert) {
      tg.showAlert(title ? `${title}\n\n${message}` : message, () => resolve());
    } else {
      alert(title ? `${title}\n\n${message}` : message);
      resolve();
    }
  });
}

export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const tg = window.Telegram?.WebApp;
    if (tg?.showConfirm) {
      tg.showConfirm(message, (ok: boolean) => resolve(Boolean(ok)));
    } else {
      resolve(window.confirm(message));
    }
  });
}

/** Кастомный popup. Возвращает id нажатой кнопки или null. */
export function showPopup(opts: {
  message: string;
  title?: string;
  buttons?: PopupButton[];
}): Promise<string | null> {
  return new Promise((resolve) => {
    const tg = window.Telegram?.WebApp;
    if (tg?.showPopup) {
      tg.showPopup(
        {
          title: opts.title,
          message: opts.message,
          buttons: opts.buttons?.map((b) => ({
            id: b.id,
            type: b.type,
            text: b.text,
          })),
        },
        (buttonId?: string) => resolve(buttonId ?? null),
      );
    } else {
      // Фолбэк вне Telegram
      if (!opts.buttons || opts.buttons.length <= 1) {
        alert((opts.title ? opts.title + '\n\n' : '') + opts.message);
        resolve(opts.buttons?.[0]?.id ?? null);
      } else {
        const ok = window.confirm((opts.title ? opts.title + '\n\n' : '') + opts.message);
        resolve(ok ? opts.buttons[opts.buttons.length - 1].id : opts.buttons[0].id);
      }
    }
  });
}
