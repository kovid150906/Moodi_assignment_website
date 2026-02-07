import { GooeyText } from './gooey-text-morphing';

const Loading = () => {
    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black">
            <div className="h-[120px] flex items-center justify-center">
                <GooeyText
                    texts={["MOOD INDIGO", "मूड इंडिगो"]}
                    morphTime={1.2}
                    cooldownTime={0.8}
                    textClassName="text-5xl md:text-6xl font-bold tracking-wider"
                    className="font-mono"
                />
            </div>
        </div>
    );
};

export default Loading;
