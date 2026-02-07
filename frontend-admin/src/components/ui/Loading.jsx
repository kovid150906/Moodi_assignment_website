import { GooeyText } from "./gooey-text-morphing";

const Loading = () => {
  return (
    <div className="fixed inset-0 bg-[#030303] flex items-center justify-center z-50">
      <div className="text-center">
        <GooeyText
          texts={["MOOD INDIGO", "ADMIN PANEL"]}
          morphTime={1.5}
          cooldownTime={0.5}
          className="h-24 flex items-center justify-center"
        />
        <div className="mt-8 flex justify-center">
          <div className="w-12 h-1 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full animate-loading-bar" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Loading;
