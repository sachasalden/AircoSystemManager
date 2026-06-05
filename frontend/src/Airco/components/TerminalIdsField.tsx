import { Field, TextInput } from './ClimateFormControls';

type TerminalIdsFieldProps = {
  value: string;
  ids: number[];
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (id: number) => void;
};

export default function TerminalIdsField({
  value,
  ids,
  onInputChange,
  onAdd,
  onRemove,
}: TerminalIdsFieldProps) {
  return (
    <Field label="Unit IDs" span={2}>
      <div style={{ display: 'flex', gap: 8 }}>
        <TextInput
          value={value}
          onChange={onInputChange}
          placeholder="e.g. 1,2,3"
        />
        <button
          type="button"
          className="action-btn action-btn-primary"
          onClick={onAdd}
        >
          Add ID
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginTop: 8,
        }}
      >
        {ids.length === 0 && <div className="empty">No unit IDs</div>}
        {ids.map((terminalId) => (
          <button
            key={terminalId}
            type="button"
            className="action-btn action-btn-danger action-btn-small"
            onClick={() => onRemove(terminalId)}
          >
            Unit {terminalId} ✕
          </button>
        ))}
      </div>
    </Field>
  );
}
