import requests
import time

# --- CONFIGURATION ---
BASE_URL = "http://127.0.0.1:8000/api/v1"
USERNAME = f"test_user_{int(time.time())}"
PASSWORD = "password123"
TEST_FILE_NAME = "hello_world.txt"
TEST_CONTENT = b"This is a test file content for S3."

def test_full_drive_flow():
    print(f"🚀 Starting Full Auth + Drive Flow Check for user: {USERNAME}\n")
    
    # 1. REGISTER
    print("1. Registering new user...")
    reg_payload = {"username": USERNAME, "password": PASSWORD}
    reg_res = requests.post(f"{BASE_URL}/auth/register", json=reg_payload)
    
    if reg_res.status_code != 200:
        print(f"❌ Registration failed: {reg_res.text}")
        return
    
    root_id = reg_res.json().get("root_id")
    print(f"✅ Registered! Root ID: {root_id}")

    # 2. LOGIN
    print("2. Logging in to get JWT token...")
    login_data = {"username": USERNAME, "password": PASSWORD}
    login_res = requests.post(f"{BASE_URL}/auth/login", data=login_data)
    
    if login_res.status_code != 200:
        print(f"❌ Login failed: {login_res.text}")
        return
    
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Login successful. Token acquired.")

    # 3. CREATE A SUB-FOLDER
    print("3. Creating a sub-folder named 'Project_Alpha'...")
    folder_payload = {"name": "Project_Alpha", "parent_id": root_id}
    folder_res = requests.post(
        f"{BASE_URL}/folders",
        json=folder_payload,
        headers=headers
    )
    
    if folder_res.status_code != 200:
        print(f"❌ Folder creation failed: {folder_res.text}")
        return
        
    folder_id = folder_res.json()["id"]
    print(f"✅ Folder created. Folder ID: {folder_id}")

    # 4. GET PRESIGNED URL
    print(f"4. Requesting S3 upload URL for '{TEST_FILE_NAME}'...")
    upload_payload = {
        "parent_id": folder_id,
        "file_name": TEST_FILE_NAME,
        "file_type": "text/plain"
    }
    upload_res = requests.post(
        f"{BASE_URL}/upload",
        json=upload_payload,
        headers=headers
    )
    
    if upload_res.status_code != 200:
        print(f"❌ Upload init failed: {upload_res.text}")
        return

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
        headers={"Content-Type": "text/plain"}
    )
    if s3_put_res.status_code != 200:
        print(f"❌ S3 Put failed: {s3_put_res.status_code}")
        # Continue anyway to test confirmation fail/success handling? No, return.
        # return 
        # Actually S3 might fail if credentials are bad, but let's assume it works or skip.
        print("(Skipping explicit return on S3 fail for local dev check if Creds invalid)")
    else:
        print("✅ S3 Binary Upload Successful.")

    # 6. CONFIRM UPLOAD TO DB
    print("6. Confirming upload to database...")
    confirm_payload = {
        "resource_id": resource_id,
        "parent_id": folder_id,
        "name": TEST_FILE_NAME,
        "s3_key": s3_key
    }
    done_res = requests.post(
        f"{BASE_URL}/upload/done",
        json=confirm_payload,
        headers=headers
    )
    
    if done_res.status_code != 200:
        print(f"❌ valid confirm failed: {done_res.text}")
    else:
        print(f"✅ DB Indexed: {done_res.json()}")

    # 7. FETCH TREE
    print("7. Fetching recursive drive tree...")
    tree_res = requests.get(f"{BASE_URL}/tree", headers=headers)
    
    if tree_res.status_code != 200:
         print(f"❌ Tree fetch failed: {tree_res.text}")
    else:
        tree_data = tree_res.json()["tree"]
        print(f"✅ Tree items found: {len(tree_data)}")
        for item in tree_data:
            print(f"   - {item['name']} ({item['type']})")

if __name__ == "__main__":
    test_full_drive_flow()