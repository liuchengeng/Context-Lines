import { useEffect, useMemo, useState } from "react";

import { AuthController, type AuthState } from "../../lib/auth-controller";

const useMocks = import.meta.env.WXT_PUBLIC_USE_MOCKS === "true";

export function useAuth() {
  const controller = useMemo(() => new AuthController(useMocks), []);
  const [state, setState] = useState<AuthState>(controller.state);

  useEffect(() => {
    const unsubscribe = controller.subscribe(setState);
    void controller.initialize();
    return () => {
      unsubscribe();
      controller.dispose();
    };
  }, [controller]);

  return {
    state,
    signIn: () => controller.signIn(),
    signOut: () => controller.signOut(),
  };
}
