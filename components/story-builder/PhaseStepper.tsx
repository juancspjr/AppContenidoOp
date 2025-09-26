/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface PhaseStepperProps {
    currentPhase: number;
    onPhaseClick: (phase: number) => void;
}

const PhaseStepper: React.FC<PhaseStepperProps> = ({ currentPhase, onPhaseClick }) => {
    
    const phases = [
        { id: 1, name: 'Concepto' },
        { id: 2, name: 'Estilo' },
        { id: 3, name: 'Personajes' },
        { id: 4, name: 'Estructura' },
        { id: 5, name: 'Plan Premium' },
        { id: 6, name: 'Producción' },
    ];

    const getPhaseStep = (phase: number) => {
        if (phase >= 1 && phase < 2) return 1;
        if (phase >= 2 && phase < 3) return 2;
        if (phase >= 3 && phase < 4) return 3;
        if (phase >= 4 && phase < 5) return 4;
        if (phase >= 5 && phase < 6) return 5;
        if (phase >= 6) return 6;
        return 1;
    };
    
    const getPhaseName = (phase: number) => {
        const step = getPhaseStep(phase);
        const basePhase = phases.find(p => p.id === step);
        if (!basePhase) return 'Fase Desconocida';

        if (step === 4 && phase === 4.5) return 'Construcción Artística';
        if (step === 5) return 'Plan Maestro Premium'; // Phase 5 is now always Premium Plan
        if (step === 6) {
            if (phase === 6.1) return 'Documentación Premium';
            if (phase === 6.2) return 'Evaluación Final';
            if (phase === 6.3) return 'Activos de Referencia';
            if (phase === 6.4) return 'Generación de Video';
        }
        return basePhase.name;
    }

    const currentStep = getPhaseStep(currentPhase);

    return (
        <nav aria-label="Progress">
            <ol role="list" className="space-y-4 md:flex md:space-x-8 md:space-y-0">
                {phases.map((phaseInfo) => {
                    const isCompleted = currentStep > phaseInfo.id;
                    const isActive = currentStep === phaseInfo.id;
                    const isClickable = isCompleted || isActive;

                    return (
                        <li key={phaseInfo.name} className="md:flex-1">
                            <button
                                onClick={() => isClickable && onPhaseClick(phaseInfo.id)}
                                disabled={!isClickable}
                                className={`group flex flex-col w-full border-l-4 py-2 pl-4 md:border-l-0 md:border-t-4 md:pl-0 md:pt-4 md:pb-0 transition-colors duration-300 text-left ${
                                    isCompleted ? 'border-green-500' : 
                                    isActive ? 'border-blue-500' : 
                                    'border-gray-600'
                                } ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                                aria-current={isActive ? 'step' : undefined}
                            >
                                <span className={`text-sm font-medium transition-colors duration-300 ${
                                    isCompleted ? 'text-green-400' :
                                    isActive ? 'text-blue-400' :
                                    'text-gray-400'
                                }`}>{`Paso ${phaseInfo.id}`}</span>
                                <span className={`text-sm font-medium ${
                                     isCompleted || isActive ? 'text-white' : 'text-gray-500'
                                }`}>
                                  {isActive ? getPhaseName(currentPhase) : phaseInfo.name}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};

export default PhaseStepper;