import { useContext, useMemo } from "react";
import { AppContext } from "../AppProvider";
import App from "../App";

export const useApp = () => {
  const { currentHeroControl, heroTitle, setHeroTitle, setHeroAs } = useContext(AppContext);
  return useMemo(() => ({ currentHeroControl, heroTitle, setHeroTitle, setHeroAs }), [currentHeroControl]);
};