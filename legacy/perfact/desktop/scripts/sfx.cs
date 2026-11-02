// x64 launcher. electron-builder's portable wrapper is a 32-bit PE even when the app inside is x64,
// so the file someone double-clicks would fail a machine-0x8664 check. This program is compiled
// /platform:x64, carries the unpacked app as a zip appended after the PE, and starts that app's Kompas.exe.
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;

static class Program {
  // The portable EXE is sometimes the Windows URL-handler instead of the
  // extracted Electron binary. Forward each supported MarketFit deep link
  // unchanged; never silently drop authenticated handoff URLs or pass arbitrary
  // command-line input into the Electron process.
  static bool SafeProtocolLink(string arg) {
    if (String.IsNullOrEmpty(arg) || arg.Length > 24500) return false;
    var options = System.Text.RegularExpressions.RegexOptions.IgnoreCase |
      System.Text.RegularExpressions.RegexOptions.CultureInvariant;
    return
      System.Text.RegularExpressions.Regex.IsMatch(arg,
        @"^(kompas|marketfit-kompas)://open/?\?d=[A-Za-z0-9_-]+$", options) ||
      System.Text.RegularExpressions.Regex.IsMatch(arg,
        @"^marketfit-kompas://open/?\?ticket=[A-Za-z0-9_-]{43}$", options) ||
      System.Text.RegularExpressions.Regex.IsMatch(arg,
        @"^(kompas|marketfit-kompas)://auth/?\?d=[A-Za-z0-9_-]{1,24000}&state=[A-Za-z0-9_-]{20,128}$", options) ||
      System.Text.RegularExpressions.Regex.IsMatch(arg,
        @"^(kompas|marketfit-kompas)://auth/?\?state=[A-Za-z0-9_-]{20,128}&d=[A-Za-z0-9_-]{1,24000}$", options) ||
      System.Text.RegularExpressions.Regex.IsMatch(arg,
        @"^marketfit-kompas://open/?$", options);
  }
  static int SelfTestLinks() {
    string ticket = new string('A',43);
    string state = new string('B',43);
    string[] allowed = {
      "marketfit-kompas://open?ticket=" + ticket,
      "marketfit-kompas://open/?ticket=" + ticket,
      "kompas://auth?d=abc_DEF-123&state=" + state,
      "marketfit-kompas://auth?d=abc_DEF-123&state=" + state,
      "marketfit-kompas://auth?state=" + state + "&d=abc_DEF-123",
      "kompas://open?d=abc_DEF-123",
      "marketfit-kompas://open",
    };
    string[] blocked = {
      "marketfit-kompas://open?ticket=short",
      "marketfit-kompas://auth?d=abc&state=short",
      "marketfit-kompas://auth?d=bad%20url&state=" + state,
      "marketfit-kompas://auth?d=abc&state=" + state + "&evil=1",
      "marketfit-kompas://auth?d=abc&state=" + state + "\"",
      "marketfit-kompas://open?ticket=" + ticket + "&d=abc",
      "marketfit-kompas://open?d=abc&state=" + state,
      "https://attacker.example/Kompas.exe",
      "javascript:alert(1)",
    };
    foreach(string link in allowed) if (!SafeProtocolLink(link)) return 2;
    foreach(string link in blocked) if (SafeProtocolLink(link)) return 3;
    return 0;
  }
  static int Main(string[] args) {
    // Built and executed by the Windows release workflow against REAL C#
    // launcher code. It does not extract anything or contact a service.
    if (args != null && args.Length == 1 && args[0] == "--self-test-links")
      return SelfTestLinks();
    string self = Process.GetCurrentProcess().MainModule.FileName;
    using (var fs = new FileStream(self, FileMode.Open, FileAccess.Read, FileShare.ReadWrite)) {
      if (fs.Length < 16) return 1;
      fs.Seek(-8, SeekOrigin.End);
      var lb = new byte[8];
      if (fs.Read(lb, 0, 8) != 8) return 1;
      long len = BitConverter.ToInt64(lb, 0);
      if (len < 32 || len > fs.Length - 8) return 1;
      long start = fs.Length - 8 - len;
      string root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Kompas", "app");
      Directory.CreateDirectory(root);
      fs.Seek(start + len - 4, SeekOrigin.Begin);
      var tail = new byte[4];
      fs.Read(tail, 0, 4);
      string stamp = len.ToString() + "-" + BitConverter.ToString(tail).Replace("-", "");
      string dest = Path.Combine(root, stamp);
      string exe = Path.Combine(dest, "Kompas.exe");
      string mark = Path.Combine(dest, ".ready");
      if (!File.Exists(exe) || !File.Exists(mark) || File.ReadAllText(mark) != stamp) {
        if (Directory.Exists(dest)) Directory.Delete(dest, true);
        Directory.CreateDirectory(dest);
        string zip = Path.Combine(root, "payload.zip");
        fs.Seek(start, SeekOrigin.Begin);
        using (var z = new FileStream(zip, FileMode.Create, FileAccess.Write, FileShare.None)) {
          var buf = new byte[1 << 20];
          long left = len;
          while (left > 0) {
            int n = fs.Read(buf, 0, (int)Math.Min(buf.Length, left));
            if (n <= 0) return 1;
            z.Write(buf, 0, n);
            left -= n;
          }
        }
        ZipFile.ExtractToDirectory(zip, dest);
        File.Delete(zip);
        File.WriteAllText(mark, stamp);
      }
      if (!File.Exists(exe)) return 1;
      // Preserve signed Chrome authentication callbacks and server-issued
      // single-use ticket links, not just the legacy base64 ?d= format.
      string url = null;
      if (args != null) foreach (string arg in args) {
        if (SafeProtocolLink(arg)) { url = arg; break; }
      }
      Process.Start(new ProcessStartInfo {
        FileName = exe, WorkingDirectory = dest, UseShellExecute = false,
        Arguments = url == null ? "" : "\"" + url + "\"",
      });
    }
    return 0;
  }
}
