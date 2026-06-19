use std::io::{self, Read, Write};

use crate::protocol::NativeHostError;

pub fn read_native_message<R: Read>(
    reader: &mut R,
    max_message_bytes: u32,
) -> Result<Option<Vec<u8>>, NativeHostError> {
    let mut length_prefix = [0_u8; 4];
    if !read_length_prefix(reader, &mut length_prefix)? {
        return Ok(None);
    }

    let message_size = u32::from_le_bytes(length_prefix);
    if message_size > max_message_bytes {
        return Err(NativeHostError::MessageTooLarge {
            size: message_size,
            max: max_message_bytes,
        });
    }

    let mut body = vec![0_u8; message_size as usize];
    reader.read_exact(&mut body)?;
    Ok(Some(body))
}

pub fn write_native_message<W: Write>(writer: &mut W, body: &[u8]) -> Result<(), NativeHostError> {
    let length = u32::try_from(body.len()).map_err(|_| NativeHostError::MessageTooLarge {
        size: u32::MAX,
        max: u32::MAX,
    })?;

    writer.write_all(&length.to_le_bytes())?;
    writer.write_all(body)?;
    writer.flush()?;
    Ok(())
}

fn read_length_prefix<R: Read>(
    reader: &mut R,
    length_prefix: &mut [u8; 4],
) -> Result<bool, NativeHostError> {
    let mut first = [0_u8; 1];
    match reader.read(&mut first) {
        Ok(0) => Ok(false),
        Ok(1) => {
            length_prefix[0] = first[0];
            reader.read_exact(&mut length_prefix[1..])?;
            Ok(true)
        }
        Ok(_) => unreachable!("one-byte buffer cannot read more than one byte"),
        Err(error) if error.kind() == io::ErrorKind::UnexpectedEof => Ok(false),
        Err(error) => Err(error.into()),
    }
}
