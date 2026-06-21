import { type AppDispatch } from "@/store";
import { type Logger } from "@/core/logger";
import { setUser } from "../store/auth.slice";
import { apiUserToUser } from "../transformers/auth.transformer";

export async function entraLoginService(
  entraLoginMutation: (args: { idToken: string }) => Promise<any>,
  values: { idToken: string },
  dispatch: AppDispatch,
  logger: Logger
): Promise<void> {
  try {
    const response = await entraLoginMutation(values);

    const user = apiUserToUser(response.user);
    dispatch(setUser(user));
    logger.audit("User logged in via Entra ID", { userId: user.id, email: user.email });

  } catch (error) {
    logger.error("Entra ID Login failed", error);
    throw error;
  }
}
