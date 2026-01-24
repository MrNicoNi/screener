import { useState } from 'react'
import { Bug } from 'lucide-react'
import { supabase } from '../lib/supabase'

const TEST_PROFILES = [
    { name: 'Admin', email: 'admin@screener.test', role: 'admin' },
    { name: 'Avaliador', email: 'avaliador@screener.test', role: 'evaluator' },
    { name: 'Analista', email: 'analista@screener.test', role: 'analyst' }
]

export function DevModeToggle() {
    const [isOpen, setIsOpen] = useState(false)

    async function switchProfile(profile) {
        try {
            // Note: This requires test users to exist in Supabase Auth
            // Password should be set to a known test password
            const { error } = await supabase.auth.signInWithPassword({
                email: profile.email,
                password: 'Test123!' // Default test password
            })

            if (error) {
                alert(`Erro ao trocar perfil: ${error.message}\n\nCertifique-se de que o usuário ${profile.email} existe no Supabase Auth com senha "Test123!"`)
            } else {
                window.location.reload()
            }
        } catch (err) {
            alert(`Erro: ${err.message}`)
        }
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-purple-100 hover:bg-purple-200 text-purple-700"
                title="Dev Mode - Trocar perfil"
            >
                <Bug size={18} />
                Dev Mode
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border z-50">
                    <div className="p-2">
                        <div className="text-xs font-medium text-gray-500 px-2 py-1">
                            Trocar Perfil
                        </div>
                        {TEST_PROFILES.map((profile) => (
                            <button
                                key={profile.email}
                                onClick={() => switchProfile(profile)}
                                className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm"
                            >
                                <div className="font-medium">{profile.name}</div>
                                <div className="text-xs text-gray-500">{profile.role}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
