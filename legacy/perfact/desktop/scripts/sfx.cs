// x64 launcher. electron-builder's portable wrapper is a 32-bit PE even when the app inside is x64,
// so the file someone double-clicks would fail a machine-0x8664 check. This program is compiled
// /platform:x64, carries the unpacked app as a zip appended after the PE, and starts that app's Kompas.exe.
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;

static class Program {
  static int Main(string[] args) {
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
      // If Windows invokes the outer portable EXE as a URL handler, preserve the
      // validated session link when passing control to the real Electron app.
      // Accept only a base64url payload so quotes and shell metacharacters
      // cannot become process arguments.
      string url = null;
      if (args != null) foreach (string arg in args) {
        if (arg != null && System.Text.RegularExpressions.Regex.IsMatch(
            arg, @"^(kompas|marketfit-kompas)://open/?\?d=[A-Za-z0-9_-]+$", System.Text.RegularExpressions.RegexOptions.IgnoreCase)) {
          url = arg;
          break;
        }
      }
      Process.Start(new ProcessStartInfo {
        FileName = exe, WorkingDirectory = dest, UseShellExecute = false,
        Arguments = url == null ? "" : "\"" + url + "\"",
      });
    }
    return 0;
  }
}
