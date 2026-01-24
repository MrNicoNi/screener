// Quick fix script for ManageUsers.jsx handleBulkCreate function
// Replace lines 169-213 with this improved version:

const handleBulkCreate = async () => {
    const validUsers = bulkUsers.filter(u => u.valid)
    if (validUsers.length === 0) return

    setBulkLoading(true)
    try {
        // 1. Check current teams to avoid duplicates
        const currentTeams = teams || []
        const createdTeamsMap = {}

        for (const teamName of newTeamsToCreate) {
            // Check if team already exists
            const existingTeam = currentTeams.find(t => t.name.toLowerCase() === teamName.toLowerCase())

            if (existingTeam) {
                console.log(`Team "${teamName}" already exists, using ID: ${existingTeam.id}`)
                createdTeamsMap[teamName.toLowerCase()] = existingTeam.id
            } else {
                try {
                    const newTeam = await createTeam({ name: teamName })
                    if (newTeam) {
                        console.log(`Created new team "${teamName}"`)
                        createdTeamsMap[teamName.toLowerCase()] = newTeam.id
                    }
                } catch (e) {
                    // If duplicate error, team was just created - that's ok
                    if (e.message && (e.message.includes('duplicate') || e.message.includes('already exists'))) {
                        console.warn(`Team "${teamName}" already exists (concurrent creation)`)
                    } else {
                        console.error(`Failed to create team ${teamName}:`, e)
                    }
                }
            }
        }

        // 2. Prepare users with team IDs
        const usersWithTeamIds = validUsers.map(u => ({
            name: u.name,
            email: u.email,
            role: u.role,
            password: u.password,
            teamId: u.teamId || createdTeamsMap[u.teamName?.toLowerCase()] || null
        }))

        console.log('📤 Creating users:', usersWithTeamIds)

        // 3. Create users
        const results = await createUsersBulk(usersWithTeamIds)

        if (!results) {
            throw new Error('Falha na criação - verifique se você está autenticado como admin')
        }

        // Always show results modal
        setBulkResults(results)
        setBulkUsers([])
        setShowBulkModal(false)

        // Show appropriate message
        const successCount = results.filter(r => r.success).length
        const errorCount = results.filter(r => !r.success).length

        if (errorCount === 0) {
            setSuccess(`✅ ${successCount} usuários criados com sucesso!`)
            setTimeout(() => setSuccess(''), 3000)
        } else if (successCount > 0) {
            setError(`⚠️ ${successCount} criados, ${errorCount} falharam. Veja detalhes no modal.`)
            setTimeout(() => setError(''), 5000)
        } else {
            setError(`❌ Falha ao criar ${errorCount} usuários. Veja detalhes no modal.`)
            setTimeout(() => setError(''), 5000)
        }
    } catch (err) {
        console.error('❌ Bulk create error:', err)
        setError('Erro na criação em massa: ' + err.message)
        setBulkResults(null)
    } finally {
        setBulkLoading(false)
    }
}
