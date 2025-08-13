import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { retrieveLaunchParams } from '@telegram-apps/sdk-react';

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5|7][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
// Если используешь ULID, раскомментируй:
// const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function StartParamRouter() {
  const navigate = useNavigate();
  const didRouteRef = useRef(false);

  useEffect(() => {
    if (didRouteRef.current) return;
    didRouteRef.current = true;

    const lp: any = retrieveLaunchParams();
    const raw =
      lp?.startParam ?? lp?.tgWebAppStartParam ?? lp?.initData?.start_param ?? null;

    if (typeof raw !== 'string') return;

    // 1) убираем возможный префикс "ev:"
    const decoded = decodeURIComponent(raw.trim());
    const candidate = decoded.startsWith('ev:') ? decoded.slice(3) : decoded;

    // 2) если это UUID — роутим
    if (UUID_REGEX.test(candidate)) {
      navigate(`/event/public/${candidate}`, { replace: true });
      return;
    }

    // 3) (опционально) поддержка ULID
    // if (ULID_REGEX.test(candidate)) {
    //   navigate(`/event/public/${candidate}`, { replace: true });
    //   return;
    // }

    // Иначе — ничего не делаем
  }, [navigate]);

  return null;
}
