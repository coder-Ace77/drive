from app.services.s3_service import s3_service
import asyncio

async def list_files():
    try:
        response = s3_service.client.list_objects_v2(Bucket=s3_service.bucket)
        if 'Contents' in response:
            for obj in response['Contents']:
                print(f"Key: {obj['Key']}")
        else:
            print("No objects found in bucket.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(list_files())
