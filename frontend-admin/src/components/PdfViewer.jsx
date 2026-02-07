import { useEffect, useRef, useState } from 'react';

const PdfViewer = ({ url, onLoad }) => {
    const [dimensions, setDimensions] = useState({ width: 842, height: 595 });

    useEffect(() => {
        if (onLoad) {
            onLoad(dimensions);
        }
    }, [onLoad, dimensions]);

    console.log('PdfViewer rendering with URL:', url);

    return (
        <div className="relative border-2 border-gray-700 shadow-2xl bg-white" style={{ width: '100%', height: '100vh' }}>
            <object
                data={url}
                type="application/pdf"
                style={{ width: '100%', height: '100vh' }}
            >
                <embed
                    src={url}
                    type="application/pdf"
                    style={{ width: '100%', height: '100vh' }}
                />
            </object>
        </div>
    );
};

export default PdfViewer;
