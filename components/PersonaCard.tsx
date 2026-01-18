'use client';

/**
 * PersonaCard - Reusable persona selection card
 * Used in /complete-onboarding page
 */

import { useRouter } from 'next/navigation';
import { PersonaType, PERSONA_METADATA, PERSONA_STEPS } from '@/lib/onboarding';

interface PersonaCardProps {
  persona: PersonaType;
  onSelect: (persona: PersonaType) => Promise<void>;
  disabled?: boolean;
}

export default function PersonaCard({ persona, onSelect, disabled = false }: PersonaCardProps) {
  const router = useRouter();
  const meta = PERSONA_METADATA[persona];
  const steps = PERSONA_STEPS[persona];

  const handleSelect = async () => {
    if (disabled) return;

    try {
      await onSelect(persona);

      // Redirect to first step
      const firstStep = steps[0].step_key;
      router.push(`/onboarding/${persona}/${firstStep}`);
    } catch (err) {
      // Error handled by parent component
    }
  };

  const colorClasses = {
    blue: {
      bg: 'bg-blue-500',
      bgLight: 'bg-blue-50',
      text: 'text-blue-600',
      textDark: 'text-blue-900',
      border: 'border-blue-200',
      hover: 'hover:border-blue-400',
    },
    purple: {
      bg: 'bg-purple-500',
      bgLight: 'bg-purple-50',
      text: 'text-purple-600',
      textDark: 'text-purple-900',
      border: 'border-purple-200',
      hover: 'hover:border-purple-400',
    },
    green: {
      bg: 'bg-green-500',
      bgLight: 'bg-green-50',
      text: 'text-green-600',
      textDark: 'text-green-900',
      border: 'border-green-200',
      hover: 'hover:border-green-400',
    },
    yellow: {
      bg: 'bg-amber-500',
      bgLight: 'bg-amber-50',
      text: 'text-amber-600',
      textDark: 'text-amber-900',
      border: 'border-amber-200',
      hover: 'hover:border-amber-400',
    },
    orange: {
      bg: 'bg-orange-500',
      bgLight: 'bg-orange-50',
      text: 'text-orange-600',
      textDark: 'text-orange-900',
      border: 'border-orange-200',
      hover: 'hover:border-orange-400',
    },
  };

  const colors = colorClasses[meta.colorTheme as keyof typeof colorClasses] || colorClasses.blue;

  return (
    <button
      onClick={handleSelect}
      disabled={disabled}
      className={`
        group relative p-8 rounded-3xl border-2 transition-all text-left w-full
        ${colors.border} ${colors.hover}
        hover:shadow-xl hover:-translate-y-1
        disabled:opacity-50 disabled:cursor-not-allowed
        ${disabled ? '' : 'cursor-pointer'}
      `}
    >
      {/* Icon */}
      <div className={`w-16 h-16 ${colors.bgLight} rounded-2xl flex items-center justify-center mb-6 ${colors.bg} bg-opacity-10 group-hover:scale-110 transition-transform`}>
        <span className={`material-symbols-outlined ${colors.text} text-4xl`}>
          {meta.icon}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-2xl font-bold text-gray-900 mb-2">
        {meta.label}
      </h3>

      {/* Description */}
      <p className="text-gray-600 mb-4">
        {meta.description}
      </p>

      {/* Steps Preview */}
      <div className="space-y-2 mb-4">
        {steps.slice(0, 3).map((step, idx) => (
          <div key={step.step_key} className="flex items-center gap-2 text-sm text-gray-500">
            <span className={`w-6 h-6 rounded-full ${colors.bgLight} ${colors.text} flex items-center justify-center text-xs font-semibold`}>
              {idx + 1}
            </span>
            <span>{step.title}</span>
          </div>
        ))}
        {steps.length > 3 && (
          <div className="text-sm text-gray-400 pl-8">
            +{steps.length - 3} more step{steps.length - 3 > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Target User */}
      <div className={`text-xs ${colors.text} font-medium border-t-2 ${colors.border} pt-4`}>
        Perfect for: {meta.targetUser}
      </div>

      {/* Hover Arrow */}
      <div className="absolute top-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className={`material-symbols-outlined ${colors.text} text-3xl`}>
          arrow_forward
        </span>
      </div>
    </button>
  );
}
