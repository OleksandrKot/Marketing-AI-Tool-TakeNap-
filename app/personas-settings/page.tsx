"use client"

import { useState } from "react"
import { User, Plus, Edit, Trash2, Save, X, DollarSign, Users, Heart, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ProfileDropdown } from "@/app/login-auth/components/profile-dropdown"
import { PageNavigation } from "@/components/page-navigation"
import ModalWrapper from "@/components/modals/ModalWrapper"

interface Persona {
  id: number
  name: string
  needs: string
  profile: string
  ageRange: string
  income: string
  status: string
  goals: string[]
}

const initialPersonas: Persona[] = [
  {
    id: 1,
    name: "The Seeker of Connection",
    needs: "Emotional support, companionship, and a sense of being valued.",
    profile:
      "A man, 18+, single or divorced, who feels lonely and seeks meaningful communication with an AI companion to feel needed and understood.",
    ageRange: "18+",
    income: "Not specified",
    status: "Single or divorced",
    goals: ["Emotional support", "Companionship", "Feel valued", "Meaningful communication"],
  },
  {
    id: 2,
    name: "The Social Strategist",
    needs: "Self-improvement in social skills and casual, stimulating conversation.",
    profile:
      "A man, 18+, with an income of ~$4k/month, who wants to learn to flirt and practice engaging, casual dialogue with an AI to boost his confidence and satisfy social needs.",
    ageRange: "18+",
    income: "~$4k/month",
    status: "Single",
    goals: ["Learn to flirt", "Practice dialogue", "Boost confidence", "Social skills improvement"],
  },
]

export default function PersonasSettingsPage() {
  const [personas, setPersonas] = useState<Persona[]>(initialPersonas)
  const [isCreating, setIsCreating] = useState(false)
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null)
  const [newPersona, setNewPersona] = useState<Omit<Persona, "id">>({
    name: "",
    needs: "",
    profile: "",
    ageRange: "",
    income: "",
    status: "",
    goals: [],
  })

  const handleCreatePersona = () => {
    if (!newPersona.name.trim()) return

    const persona: Persona = {
      id: Date.now(),
      ...newPersona,
      goals: newPersona.goals.filter((goal) => goal.trim() !== ""),
    }

    setPersonas([...personas, persona])
    setNewPersona({
      name: "",
      needs: "",
      profile: "",
      ageRange: "",
      income: "",
      status: "",
      goals: [],
    })
    setIsCreating(false)
  }

  const handleEditPersona = (persona: Persona) => {
    setEditingPersona({ ...persona })
  }

  const handleSaveEdit = () => {
    if (!editingPersona) return

    setPersonas(personas.map((p) => (p.id === editingPersona.id ? editingPersona : p)))
    setEditingPersona(null)
  }

  const handleDeletePersona = (id: number) => {
    if (confirm("Are you sure you want to delete this persona?")) {
      setPersonas(personas.filter((p) => p.id !== id))
    }
  }

  const handleAddGoal = (goal: string, isEditing = false) => {
    if (goal.trim()) {
      if (isEditing && editingPersona) {
        if (!editingPersona.goals.includes(goal.trim())) {
          setEditingPersona({
            ...editingPersona,
            goals: [...editingPersona.goals, goal.trim()],
          })
        }
      } else {
        if (!newPersona.goals.includes(goal.trim())) {
          setNewPersona({
            ...newPersona,
            goals: [...newPersona.goals, goal.trim()],
          })
        }
      }
    }
  }

  const handleRemoveGoal = (goalToRemove: string, isEditing = false) => {
    if (isEditing && editingPersona) {
      setEditingPersona({
        ...editingPersona,
        goals: editingPersona.goals.filter((goal) => goal !== goalToRemove),
      })
    } else {
      setNewPersona({
        ...newPersona,
        goals: newPersona.goals.filter((goal) => goal !== goalToRemove),
      })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Hero section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
          <div>
            <h1 className="text-5xl font-bold text-slate-900 mb-3 tracking-tight">Personas Settings</h1>
            <p className="text-slate-600 font-medium text-lg">
              Manage your user personas for targeted creative adaptations
            </p>
          </div>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <PageNavigation currentPage="personas" />
            <ProfileDropdown />
          </div>
        </div>

        {/* Create New Persona Button */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Your Personas</h2>
          </div>
          <Button
            onClick={() => setIsCreating(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 px-6 transition-all duration-200"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Persona
          </Button>
        </div>

        {/* Create New Persona Form */}
        {isCreating && (
          <Card className="border-slate-200 rounded-2xl mb-8">
            <CardHeader className="border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900">Create New Persona</h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsCreating(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Persona Name *</label>
                    <Input
                      placeholder="e.g., The Ambitious Professional"
                      value={newPersona.name}
                      onChange={(e) => setNewPersona({ ...newPersona, name: e.target.value })}
                      className="border-slate-200 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Age Range</label>
                    <Input
                      placeholder="e.g., 25-35"
                      value={newPersona.ageRange}
                      onChange={(e) => setNewPersona({ ...newPersona, ageRange: e.target.value })}
                      className="border-slate-200 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Income Level</label>
                    <Input
                      placeholder="e.g., $5k-8k/month"
                      value={newPersona.income}
                      onChange={(e) => setNewPersona({ ...newPersona, income: e.target.value })}
                      className="border-slate-200 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Relationship Status</label>
                    <Input
                      placeholder="e.g., Single, Married, Divorced"
                      value={newPersona.status}
                      onChange={(e) => setNewPersona({ ...newPersona, status: e.target.value })}
                      className="border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Primary Needs *</label>
                    <Textarea
                      placeholder="Describe what this persona needs and is looking for..."
                      value={newPersona.needs}
                      onChange={(e) => setNewPersona({ ...newPersona, needs: e.target.value })}
                      className="border-slate-200 rounded-lg min-h-[100px] resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Profile Description *</label>
                    <Textarea
                      placeholder="Detailed description of this persona's background, characteristics, and behavior..."
                      value={newPersona.profile}
                      onChange={(e) => setNewPersona({ ...newPersona, profile: e.target.value })}
                      className="border-slate-200 rounded-lg min-h-[120px] resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Goals & Motivations</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {newPersona.goals.map((goal, index) => (
                        <Badge
                          key={index}
                          className="bg-blue-50 text-blue-700 border-blue-200 font-medium px-3 py-1 rounded-full border"
                        >
                          {goal}
                          <button
                            onClick={() => handleRemoveGoal(goal)}
                            className="ml-2 text-blue-500 hover:text-blue-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <Input
                      placeholder="Add a goal and press Enter"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleAddGoal(e.currentTarget.value)
                          e.currentTarget.value = ""
                        }
                      }}
                      className="border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-slate-200">
                <Button
                  variant="outline"
                  onClick={() => setIsCreating(false)}
                  className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-xl h-11 px-6"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreatePersona}
                  disabled={!newPersona.name.trim() || !newPersona.needs.trim() || !newPersona.profile.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 px-6 transition-all duration-200 disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Create Persona
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Persona Modal */}
        {editingPersona && (
          <ModalWrapper isOpen={!!editingPersona} onClose={() => setEditingPersona(null)} panelClassName="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-4">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader className="border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900">Edit Persona</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingPersona(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Persona Name *</label>
                      <Input
                        placeholder="e.g., The Ambitious Professional"
                        value={editingPersona.name}
                        onChange={(e) => setEditingPersona({ ...editingPersona, name: e.target.value })}
                        className="border-slate-200 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Age Range</label>
                      <Input
                        placeholder="e.g., 25-35"
                        value={editingPersona.ageRange}
                        onChange={(e) => setEditingPersona({ ...editingPersona, ageRange: e.target.value })}
                        className="border-slate-200 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Income Level</label>
                      <Input
                        placeholder="e.g., $5k-8k/month"
                        value={editingPersona.income}
                        onChange={(e) => setEditingPersona({ ...editingPersona, income: e.target.value })}
                        className="border-slate-200 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Relationship Status</label>
                      <Input
                        placeholder="e.g., Single, Married, Divorced"
                        value={editingPersona.status}
                        onChange={(e) => setEditingPersona({ ...editingPersona, status: e.target.value })}
                        className="border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Primary Needs *</label>
                      <Textarea
                        placeholder="Describe what this persona needs and is looking for..."
                        value={editingPersona.needs}
                        onChange={(e) => setEditingPersona({ ...editingPersona, needs: e.target.value })}
                        className="border-slate-200 rounded-lg min-h-[100px] resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Profile Description *</label>
                      <Textarea
                        placeholder="Detailed description of this persona's background, characteristics, and behavior..."
                        value={editingPersona.profile}
                        onChange={(e) => setEditingPersona({ ...editingPersona, profile: e.target.value })}
                        className="border-slate-200 rounded-lg min-h-[120px] resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Goals & Motivations</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {editingPersona.goals.map((goal, index) => (
                          <Badge
                            key={index}
                            className="bg-blue-50 text-blue-700 border-blue-200 font-medium px-3 py-1 rounded-full border"
                          >
                            {goal}
                            <button
                              onClick={() => handleRemoveGoal(goal, true)}
                              className="ml-2 text-blue-500 hover:text-blue-700"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <Input
                        placeholder="Add a goal and press Enter"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleAddGoal(e.currentTarget.value, true)
                            e.currentTarget.value = ""
                          }
                        }}
                        className="border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-slate-200">
                  <Button
                    variant="outline"
                    onClick={() => setEditingPersona(null)}
                    className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-xl h-11 px-6"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    disabled={
                      !editingPersona.name.trim() || !editingPersona.needs.trim() || !editingPersona.profile.trim()
                    }
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 px-6 transition-all duration-200 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </ModalWrapper>
        )}

        {/* Existing Personas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {personas.map((persona) => (
            <Card key={persona.id} className="border-slate-200 rounded-2xl hover:shadow-lg transition-all duration-300">
              <CardHeader className="border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-4">
                      <User className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{persona.name}</h3>
                      <p className="text-sm text-slate-500">Persona ID: {persona.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditPersona(persona)}
                      className="text-slate-500 hover:text-slate-700"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePersona(persona.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  {/* Demographics */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center mb-2">
                        <Users className="h-4 w-4 text-slate-500 mr-2" />
                        <span className="text-xs font-medium text-slate-500">Age</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{persona.ageRange}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center mb-2">
                        <DollarSign className="h-4 w-4 text-slate-500 mr-2" />
                        <span className="text-xs font-medium text-slate-500">Income</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{persona.income}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center mb-2">
                        <Heart className="h-4 w-4 text-slate-500 mr-2" />
                        <span className="text-xs font-medium text-slate-500">Status</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{persona.status}</p>
                    </div>
                  </div>

                  {/* Needs */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                      <Target className="h-4 w-4 mr-2 text-blue-600" />
                      Primary Needs
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed bg-blue-50 p-3 rounded-lg">{persona.needs}</p>
                  </div>

                  {/* Profile */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2">Profile Description</h4>
                    <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg">
                      {persona.profile}
                    </p>
                  </div>

                  {/* Goals */}
                  {persona.goals.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-2">Goals & Motivations</h4>
                      <div className="flex flex-wrap gap-2">
                        {persona.goals.map((goal, index) => (
                          <Badge
                            key={index}
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium px-3 py-1 rounded-full border text-xs"
                          >
                            {goal}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {personas.length === 0 && !isCreating && (
          <Card className="border-slate-200 rounded-2xl">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Personas Yet</h3>
              <p className="text-slate-500 mb-6">
                Create your first persona to start generating targeted creative adaptations.
              </p>
              <Button
                onClick={() => setIsCreating(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl h-11 px-6"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Persona
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
