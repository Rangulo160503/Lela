import { useState } from 'react'
import { apiPost } from '../../data/api'
import { AdminDrawer } from './AdminDrawer'

type UserRow = {
  id: string
  username: string
  displayName: string
  role: string
  active: boolean
}

type UsersPanelProps = {
  users: UserRow[]
  onSaved: () => void
}

const emptyForm = {
  username: '',
  displayName: '',
  role: 'empleado',
  pin: '0000',
}

export function UsersPanel({ users, onSaved }: UsersPanelProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  return (
    <section className="admin-panel">
      <div className="ds-toolbar">
        <h2 className="ds-toolbar__title">Usuarios</h2>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            setForm(emptyForm)
            setOpen(true)
          }}
        >
          Nuevo
        </button>
      </div>

      {users.length === 0 ? (
        <p className="ds-empty">Sin usuarios.</p>
      ) : (
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.displayName}</td>
                  <td>@{u.username}</td>
                  <td>{u.role}</td>
                  <td>{u.active ? 'Activo' : 'Inactivo'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminDrawer
        open={open}
        title="Nuevo usuario"
        onClose={() => setOpen(false)}
        footer={
          <button
            type="button"
            className="btn btn--primary"
            onClick={async () => {
              await apiPost('/users', form)
              setOpen(false)
              onSaved()
            }}
          >
            Guardar usuario
          </button>
        }
      >
        <div className="admin-form">
          <label className="field">
            <span className="field__label">Usuario</span>
            <input
              className="field__input"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span className="field__label">Nombre</span>
            <input
              className="field__input"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span className="field__label">Rol</span>
            <select
              className="field__input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="empleado">Empleado</option>
              <option value="admin">Admin</option>
              <option value="principal">Principal</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">PIN</span>
            <input
              className="field__input"
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value })}
              autoComplete="off"
              inputMode="numeric"
            />
          </label>
        </div>
      </AdminDrawer>
    </section>
  )
}
