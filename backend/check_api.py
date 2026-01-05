import requests
import uuid

# --- CONFIGURATION ---
BASE_URL = "http://127.0.0.1:8000"
USERNAME = f"test"
PASSWORD = "test"
TEST_FILE_NAME = "hello_world.txt"
TEST_CONTENT = b"This is a test file content for S3."

def test_full_drive_flow():
    print(f"🚀 Starting Full Auth + Drive Flow Check for user: {USERNAME}\n")
    
    # 1. REGISTER
    print("1. Registering new user...")
    reg_res = requests.post(
        f"{BASE_URL}/register", 
        params={"username": USERNAME, "password": PASSWORD}
    )
    if reg_res.status_code != 200:
        print(f"❌ Registration failed: {reg_res.text}")
        return
    root_id = reg_res.json()["root_id"]
    print(f"✅ Registered! Root ID: {root_id}")

    # 2. LOGIN
    print("2. Logging in to get JWT token...")
    # Note: Login uses form-data as per OAuth2PasswordRequestForm
    login_res = requests.post(
        f"{BASE_URL}/login", 
        data={"username": USERNAME, "password": PASSWORD}
    )
    if login_res.status_code != 200:
        print(f"❌ Login failed: {login_res.text}")
        return
    
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Login successful. Token acquired.")

    # 3. CREATE A SUB-FOLDER
    print("3. Creating a sub-folder named 'Project_Alpha'...")
    folder_res = requests.post(
        f"{BASE_URL}/folders",
        params={"name": "Project_Alpha", "parent_id": root_id},
        headers=headers
    )
    folder_id = folder_res.json()["id"]
    print(f"✅ Folder created. Folder ID: {folder_id}")

    # 4. GET PRESIGNED URL (Inside the new folder)
    print(f"4. Requesting S3 upload URL for '{TEST_FILE_NAME}'...")
    upload_res = requests.post(
        f"{BASE_URL}/upload",
        params={"parent_id": folder_id, "file_name": TEST_FILE_NAME},
        headers=headers
    )
    u_data = upload_res.json()
    presigned_url = u_data["url"]
    resource_id = u_data["resource_id"]
    s3_key = u_data["s3_key"]
    print(f"✅ S3 URL received. Resource ID: {resource_id}")

    # 5. PHYSICAL UPLOAD TO S3
    print("5. Uploading bits directly to S3...")
    s3_put_res = requests.put(
        presigned_url, 
        data=TEST_CONTENT, 
        headers={"Content-Type": "application/octet-stream"}
    )
    if s3_put_res.status_code != 200:
        print(f"❌ S3 Put failed: {s3_put_res.status_code}")
        return
    print("✅ S3 Binary Upload Successful.")

    # 6. CONFIRM UPLOAD TO DB
    print("6. Confirming upload to database...")
    done_res = requests.post(
        f"{BASE_URL}/upload/done",
        params={
            "resource_id": resource_id,
            "parent_id": folder_id,
            "name": TEST_FILE_NAME,
            "s3_key": s3_key
        },
        headers=headers
    )
    print(f"✅ DB Indexed: {done_res.json()}")

    # 7. FETCH TREE & VERIFY HIERARCHY
    print("7. Fetching recursive drive tree...")
    tree_res = requests.get(f"{BASE_URL}/tree", headers=headers)
    tree_data = tree_res.json()["tree"]
    
    # Check if we have the root, the folder, and the file
    print(f"✅ Tree items found: {len(tree_data)}")
    for item in tree_data:
        print(f"   - {item['name']} ({item['type']})")

    # 8. CLEANUP (DELETE FILE)
    # print(f"\n8. Deleting file {resource_id}...")
    # del_res = requests.delete(f"{BASE_URL}/delete/{resource_id}", headers=headers)
    # print(f"✅ Final Cleanup: {del_res.json()['message']}")

if __name__ == "__main__":
    test_full_drive_flow()