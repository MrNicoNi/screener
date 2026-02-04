import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [userProfile, setUserProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
            if (session?.user) {
                fetchUserProfile(session.user.id)
            } else {
                setLoading(false)
            }
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
            if (session?.user) {
                fetchUserProfile(session.user.id)
            } else {
                setUserProfile(null)
                setLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    async function fetchUserProfile(userId) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*, team:teams(id, name)')
                .eq('id', userId)
                .single()

            if (error) throw error
            setUserProfile(data)
        } catch (error) {
            console.error('[Auth] Profile fetch failed:', error.message)
            setUserProfile(null)
        } finally {
            setLoading(false)
        }
    }

    async function login(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (error) throw error
            return { data, error: null }
        } catch (error) {
            return { data: null, error }
        }
    }

    async function logout() {
        await supabase.auth.signOut()
        setUser(null)
        setUserProfile(null)
    }

    const value = {
        user,
        userProfile,
        loading,
        login,
        logout,
        isAdmin: userProfile?.role === 'admin',
        isEvaluator: userProfile?.role === 'evaluator' || userProfile?.role === 'admin',
        isAnalyst: userProfile?.role === 'analyst',
        mustChangePassword: userProfile?.must_change_password || false
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}
