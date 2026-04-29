import type { KnowledgeType } from '../../types';
import { KNOWLEDGE_TYPE_LABELS } from '../../config/constants';

interface KnowledgeCardProps {
  title: string;
  content: string;
  quote?: string;
  type: KnowledgeType;
}

export default function KnowledgeCard({ title, content, quote, type }: KnowledgeCardProps) {
  const badgeStyles = {
    tacit: 'bg-amber-light text-amber',
    emergency: 'bg-red-light text-red-danger',
    relational: 'bg-green-pale text-green-mid',
    explicit: 'bg-blue-light text-blue-info',
    exception: 'bg-amber-light text-amber', // shared with tacit for now
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-cream-dark shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <span className={`label-caps px-2 py-0.5 rounded text-[9px] ${badgeStyles[type]}`}>
          {KNOWLEDGE_TYPE_LABELS[type]}
        </span>
      </div>
      
      <h4 className="text-xl font-serif mb-3 text-text-dark">{title}</h4>
      <p className="text-text-mid text-sm leading-relaxed mb-4">{content}</p>
      
      {quote && (
        <blockquote className="mt-4 text-xs italic text-text-light border-l border-amber pl-3 py-1">
          "{quote}"
        </blockquote>
      )}
    </div>
  );
}
