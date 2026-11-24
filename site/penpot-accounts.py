# The accounts of the test site, made, put back, listed or deleted with the backend's own tool, its prepl (the server
# manage.py talks to), inside the backend container. Its input's first line is the base64 of a JSON list of
# {"fullname", "email", "password"} (made, or put back when they are there), {"email", "action": "delete"} (deleted
# for good) or {"email", "action": "search"} (said whether it is there); the script itself comes after it on the same
# input (python3 -c reads the first line, then runs the rest), or it runs as a file (python3 penpot-accounts.py) with
# that one line as its input. Never a password on a command line, never in a file.
import base64, json, socket, sys

payload = json.loads(base64.b64decode(sys.stdin.readline().strip()))


def send(data):
    with socket.create_connection(("localhost", 6063)) as s:
        f = s.makefile(mode="rw")
        json.dump(data, f)
        f.write("\n")
        f.flush()
        while True:
            line = f.readline()
            if not line:
                return None, {"hint": "the prepl closed the connection"}
            result = json.loads(line)
            if result.get("tag") == "ret":
                return result.get("val"), result.get("err")


status = 0
for p in payload:
    action = p.get("action", "ensure")
    found, err = send({"cmd": "search-profile", "params": {"email": p["email"]}})
    if err:
        print(f"Account {p['email']}: {err.get('hint')}")
        status = 1
        continue
    if action == "search":
        print(f"Account {p['email']}: {found.get('fullname') if isinstance(found, dict) else 'here'}" if found else f"Account {p['email']}: not on the site")
        continue
    if action == "delete":
        if not found:
            print(f"Account {p['email']}: not on the site")
            continue
        res, err = send({"cmd": "delete-profile", "params": {"email": p["email"], "soft": False}})
        print(f"Account {p['email']}: deleted" if not err else f"Account {p['email']}: {err.get('hint')}")
    elif found:
        res, err = send({"cmd": "update-profile", "params": {"email": p["email"], "fullname": p["fullname"],
                                                             "password": p["password"], "is-active": True}})
        print(f"Account {p['email']}: put back" if not err else f"Account {p['email']}: {err.get('hint')}")
    else:
        res, err = send({"cmd": "create-profile", "params": {"fullname": p["fullname"], "email": p["email"],
                                                             "password": p["password"], "is-active": True}})
        print(f"Account {p['email']}: made" if not err else f"Account {p['email']}: {err.get('hint')}")
    status = status or (1 if err else 0)
sys.exit(status)
