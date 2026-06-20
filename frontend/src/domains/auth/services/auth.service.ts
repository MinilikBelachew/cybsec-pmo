import { type AppDispatch } from "@/store";
import { type Logger } from "@/core/logger";
import { setUser } from "../store/auth.slice";
import { apiUserToUser } from "../transformers/auth.transformer";

/**
 * Orchestration layer: no HTTP calls, no UI. Just transformation + side effects.
 * Logger is injected (not imported) for easy unit testing.
 */
export async function loginService(
  loginMutation: (args: { email: string; password: string }) => Promise<any>,
  values: { email: string; password: string },
  dispatch: AppDispatch,
  logger: Logger
): Promise<void> {
  try {
    const response = await loginMutation(values);
    const user = apiUserToUser(response.user);
    dispatch(setUser(user));
    logger.audit("User logged in", { userId: user.id, email: user.email });
  } catch (error) {
    logger.error("Login failed", error);
    throw error;
  }
}

export async function registerService(
  registerMutation: (args: { name: string; email: string; password: string }) => Promise<any>,
  values: { name: string; email: string; password: string },
  dispatch: AppDispatch,
  logger: Logger
): Promise<void> {
  try {
    const response = await registerMutation(values);
    const user = apiUserToUser(response.user);
    dispatch(setUser(user));
    logger.audit("User registered", { userId: user.id, email: user.email });
  } catch (error) {
    logger.error("Registration failed", error);
    throw error;
  }
}
