namespace ClinicApp.ErrorHandling;

public sealed record FieldIssue(string Field, string Message, string? Code = null, string? RecordId = null);

/// <summary>Only deliberate, public domain messages belong here. Never wrap exception.Message.</summary>
public sealed class ApiFailure : Exception
{
    public int Status { get; }
    public string Code { get; }
    public string? RecordId { get; }
    public IReadOnlyList<FieldIssue> Errors { get; }
    public ApiFailure(int status, string code, string publicMessage, IEnumerable<FieldIssue>? errors = null, string? recordId = null)
        : base(publicMessage)
    {
        if (status is < 400 or > 599) throw new ArgumentOutOfRangeException(nameof(status));
        Status = status;
        Code = code;
        RecordId = recordId;
        Errors = errors?.ToArray() ?? [];
    }
}
