"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { WizardLayout } from "@/components/agents/wizard/wizard-layout";
import { StepIdentity } from "@/components/agents/wizard/step-identity";
import { StepInstructions } from "@/components/agents/wizard/step-instructions";
import { StepSkills } from "@/components/agents/wizard/step-skills";
import { StepTestRun } from "@/components/agents/wizard/step-test-run";
import { api } from "@/lib/api";

const STEP_LABELS = ["Identity", "Instructions", "Templates", "Test Run"];

interface WizardState {
  name: string;
  description: string;
  category: string;
  color: string;
  icon: string;
  instructions: string;
  llmModel: string;
}

export default function NewAgentPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [wizardState, setWizardState] = useState<WizardState>({
    name: "",
    description: "",
    category: "conversational",
    color: "#3b82f6",
    icon: "bot",
    instructions: "",
    llmModel: "anthropic/claude-sonnet-4-6",
  });

  const updateWizard = (updates: Partial<WizardState>) => {
    setWizardState((prev) => ({ ...prev, ...updates }));
  };

  const nextDisabled =
    (currentStep === 1 && !wizardState.name.trim()) ||
    (currentStep === 2 && !wizardState.instructions.trim());

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.createAgent({
        name: wizardState.name.trim(),
        instructions: wizardState.instructions.trim(),
        description: wizardState.description.trim(),
        category: wizardState.category,
        color: wizardState.color,
        icon: wizardState.icon,
        source: "mastra",
        llmModel: wizardState.llmModel,
      });
      router.push("/agents");
    } catch {
      alert("Failed to create agent. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-2.5rem)]">
      {/* Breadcrumb */}
      <div className="px-6 md:px-12 pt-4">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Agents
        </Link>
      </div>

      <WizardLayout
        step={currentStep}
        totalSteps={4}
        stepLabels={STEP_LABELS}
        onBack={() => setCurrentStep((s) => Math.max(1, s - 1))}
        onNext={() => setCurrentStep((s) => Math.min(4, s + 1))}
        onSave={handleSave}
        saving={saving}
        nextDisabled={nextDisabled}
      >
        {currentStep === 1 && (
          <StepIdentity
            value={{
              name: wizardState.name,
              description: wizardState.description,
              category: wizardState.category,
              color: wizardState.color,
              icon: wizardState.icon,
            }}
            onChange={updateWizard}
          />
        )}
        {currentStep === 2 && (
          <StepInstructions
            value={{
              instructions: wizardState.instructions,
              llmModel: wizardState.llmModel,
            }}
            onChange={updateWizard}
          />
        )}
        {currentStep === 3 && (
          <StepSkills
            currentInstructions={wizardState.instructions}
            onChange={updateWizard}
          />
        )}
        {currentStep === 4 && (
          <StepTestRun
            agentConfig={{
              name: wizardState.name,
              instructions: wizardState.instructions,
              llmModel: wizardState.llmModel,
            }}
          />
        )}
      </WizardLayout>
    </div>
  );
}
