import { useContext, useMemo } from "react";
import { LogContext } from "../LogProvider";

export const useLogs = () => {
  const { logs, appendLog } = useContext(LogContext);
  return useMemo(() => ({ logs, appendLog }), [logs]);
};