import { useContext, useMemo } from "react";
import { EventContext } from "../EventProvider";

export const useEvent = () => {
  const { event, setEvent } = useContext(EventContext);
  return useMemo(() => ({ event, setEvent }), [event]);
};