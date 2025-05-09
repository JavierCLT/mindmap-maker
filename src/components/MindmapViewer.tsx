import React, { useEffect, useRef } from 'react';
import { Markmap } from 'markmap-view';
import { Transformer } from 'markmap-lib';

interface MindmapViewerProps {
  markdown: string;
}

const transformer = new Transformer();

const MindmapViewer: React.FC<MindmapViewerProps> = ({ markdown }) => {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (ref.current && markdown) {
      try {
        const { root } = transformer.transform(markdown);
        const markmap = Markmap.create(ref.current, { autoFit: true });
        markmap.setData(root);
      } catch (error) {
        console.error('Error rendering mindmap:', error);
      }
    }
  }, [markdown]);

  return <svg ref={ref} className="w-full h-full" />;
};

export default MindmapViewer;