import { useState, useEffect } from 'react';
import { User, Save, Download, Trash2, Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { OwnerProfile } from '@/lib/types';
import { SectionLoader } from './ui';

export function ProfilePage() {
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const [interestInput, setInterestInput] = useState('');
  const [goalInput, setGoalInput] = useState('');
  const [projectInput, setProjectInput] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    const { data } = await supabase
      .from('owner_profile')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    setProfile(data as OwnerProfile | null);
    setLoading(false);
  }

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    await supabase.from('owner_profile').update({
      name: profile.name,
      preferred_name: profile.preferred_name,
      skills: profile.skills,
      interests: profile.interests,
      goals: profile.goals,
      communication_preferences: profile.communication_preferences,
      projects: profile.projects,
      additional_info: profile.additional_info,
    }).eq('id', 1);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function exportProfile() {
    if (!profile) return;
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deva-owner-profile.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function resetProfile() {
    if (!confirm('Reset profile to defaults? This will clear all fields.')) return;
    const { data } = await supabase.from('owner_profile').update({
      name: 'Hirwa Christian',
      preferred_name: 'Christian',
      skills: [],
      interests: [],
      goals: [],
      communication_preferences: '',
      projects: [],
      additional_info: '',
    }).eq('id', 1).select('*').maybeSingle();
    setProfile(data as OwnerProfile | null);
  }

  function addToArray(field: keyof OwnerProfile, value: string) {
    if (!profile || !value.trim()) return;
    setProfile({ ...profile, [field]: [...(profile[field] as string[]), value.trim()] } as OwnerProfile);
  }

  function removeFromArray(field: keyof OwnerProfile, index: number) {
    if (!profile) return;
    const arr = [...(profile[field] as string[])];
    arr.splice(index, 1);
    setProfile({ ...profile, [field]: arr } as OwnerProfile);
  }

  if (loading) return <SectionLoader />;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center">
              <User size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Owner Profile</h1>
              <p className="text-xs text-[var(--text-muted)]">Deva uses this to personalize responses</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={exportProfile} className="btn-secondary text-xs py-2 px-3">
              <Download size={14} /> Export
            </button>
            <button onClick={saveProfile} disabled={saving} className="btn-primary text-xs py-2 px-3">
              <Save size={14} /> {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>

        {profile && (
          <div className="space-y-5">
            {/* Basic info */}
            <div className="glass rounded-xl p-5 animate-fade-in-up">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Identity</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Full Name</label>
                  <input
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Preferred Name</label>
                  <input
                    value={profile.preferred_name}
                    onChange={(e) => setProfile({ ...profile, preferred_name: e.target.value })}
                    className="input-base"
                  />
                </div>
              </div>
            </div>

            {/* Skills */}
            <div className="glass rounded-xl p-5 animate-fade-in-up">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Skills</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {profile.skills.map((skill, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                    {skill}
                    <button onClick={() => removeFromArray('skills', i)} className="hover:text-red-400">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { addToArray('skills', skillInput); setSkillInput(''); } }}
                  placeholder="Add a skill..."
                  className="input-base flex-1 text-sm"
                />
                <button onClick={() => { addToArray('skills', skillInput); setSkillInput(''); }} className="btn-secondary text-sm py-2 px-3">
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Interests */}
            <div className="glass rounded-xl p-5 animate-fade-in-up">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Interests</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {profile.interests.map((interest, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                    {interest}
                    <button onClick={() => removeFromArray('interests', i)} className="hover:text-red-400">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { addToArray('interests', interestInput); setInterestInput(''); } }}
                  placeholder="Add an interest..."
                  className="input-base flex-1 text-sm"
                />
                <button onClick={() => { addToArray('interests', interestInput); setInterestInput(''); }} className="btn-secondary text-sm py-2 px-3">
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Goals */}
            <div className="glass rounded-xl p-5 animate-fade-in-up">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Goals</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {profile.goals.map((goal, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                    {goal}
                    <button onClick={() => removeFromArray('goals', i)} className="hover:text-red-400">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { addToArray('goals', goalInput); setGoalInput(''); } }}
                  placeholder="Add a goal..."
                  className="input-base flex-1 text-sm"
                />
                <button onClick={() => { addToArray('goals', goalInput); setGoalInput(''); }} className="btn-secondary text-sm py-2 px-3">
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Projects */}
            <div className="glass rounded-xl p-5 animate-fade-in-up">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Projects</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {profile.projects.map((project, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                    {project}
                    <button onClick={() => removeFromArray('projects', i)} className="hover:text-red-400">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={projectInput}
                  onChange={(e) => setProjectInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { addToArray('projects', projectInput); setProjectInput(''); } }}
                  placeholder="Add a project..."
                  className="input-base flex-1 text-sm"
                />
                <button onClick={() => { addToArray('projects', projectInput); setProjectInput(''); }} className="btn-secondary text-sm py-2 px-3">
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Communication preferences */}
            <div className="glass rounded-xl p-5 animate-fade-in-up">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Communication Preferences</h3>
              <textarea
                value={profile.communication_preferences}
                onChange={(e) => setProfile({ ...profile, communication_preferences: e.target.value })}
                placeholder="How should Deva communicate with you? (e.g., be concise, use technical language, etc.)"
                className="input-base min-h-[80px] resize-none"
              />
            </div>

            {/* Additional info */}
            <div className="glass rounded-xl p-5 animate-fade-in-up">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Additional Information</h3>
              <textarea
                value={profile.additional_info}
                onChange={(e) => setProfile({ ...profile, additional_info: e.target.value })}
                placeholder="Any other information Deva should know about you..."
                className="input-base min-h-[80px] resize-none"
              />
            </div>

            {/* Danger zone */}
            <div className="glass rounded-xl p-5 border border-red-500/20">
              <h3 className="text-sm font-semibold text-red-400 mb-3">Danger Zone</h3>
              <button onClick={resetProfile} className="btn-secondary text-sm text-red-400 border-red-500/30 hover:bg-red-500/10">
                <Trash2 size={14} /> Reset Profile to Defaults
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
